import { z } from "zod";

import {
  createChatMessage,
  createChatSession,
  findChatSessionByIdForUser,
  listMessagesForSession,
  type ChatMessageRow,
} from "../../db/chat-repository.js";
import { loadServerEnv } from "../../env.js";
import { HttpError } from "../../utils/http-error.js";
import { getOpenAiCompatibleProviderConfig } from "../ai/openai-compatible-provider-config.js";
import {
  runOpenAiCompatibleToolChat,
  type ToolChatMessage,
  type ToolChatResult,
} from "../ai/openai-compatible-tool-chat.js";
import { executeAiTool } from "../ai/tools/tool-executor.js";
import { verifyAnswerFaithfulness } from "./answer-faithfulness.js";
import type { AssistantStructuredAnswer } from "./assistant-answer-composer.js";
import {
  runMockAssistantTurn,
  type AssistantOrchestratorOptions,
  type AssistantTurnExecutionResult,
  type MockAssistantTurnResponseData,
} from "./assistant-orchestrator-service.js";
import { getDefaultAssistantProviderGuard } from "./assistant-provider-guard.js";
import {
  classifyAssistantSafety,
  composeMedicalSafetyAnswer,
  isAssistantSafetyGateEnabled,
} from "./assistant-safety.js";
import type { AssistantStreamEvent } from "./assistant-stream-types.js";
import {
  estimateAssistantProviderCallCostUsd,
  summarizeTurnLlmCalls,
  type AssistantLlmCallRecord,
} from "./assistant-turn-observability.js";
import {
  answerToHistoryText,
  buildCoachAnswer,
  compactToolOutputForModel,
  type CoachToolRun,
} from "./coach-answer.js";
import { buildCoachSystemPrompt, COACH_TOOL_SPECS } from "./coach-prompt.js";

/** Model calls per turn, including the final answer. */
const MAX_MODEL_CALLS = 6;
/** Earlier messages (user and assistant) sent as conversation history. */
const HISTORY_MESSAGE_LIMIT = 8;
const MAX_OUTPUT_TOKENS = 900;
/** Later calls carry several tool results, so they get more time than routing calls. */
const MODEL_CALL_TIMEOUT_MS = 45_000;
const ANSWER_DELTA_CHUNK_SIZE = 24;
const FALLBACK_TIME_ZONE = "Asia/Shanghai";

/**
 * The coach answers free text only. Requests that carry structure (a quick
 * prompt mode, an explicit range, a tapped exercise, plan preferences) keep the
 * rule-routed pipeline that was built for them.
 */
const coachTurnSchema = z
  .object({
    mode: z.literal("auto"),
    message: z.string().trim().min(1),
    session_id: z.string().uuid().optional(),
    timezone: z.string().trim().min(1).optional(),
  })
  .strict();

type CoachTurnInput = z.infer<typeof coachTurnSchema>;

/**
 * Whether the model-led coach is selected for this process.
 *
 * @returns True when `ASSISTANT_ENGINE=coach` and the provider can run it.
 */
export function isCoachEngineEnabled(): boolean {
  const env = loadServerEnv();

  return (
    env.assistantEngine === "coach" &&
    env.assistantProvider === "openai_compatible"
  );
}

/**
 * Runs one assistant turn with whichever pipeline is selected.
 *
 * @param userId - Authenticated user.
 * @param rawInput - Request body.
 * @param options - Stream callback and request-scoped guards.
 * @returns The turn result.
 */
export async function runAssistantTurn(
  userId: string,
  rawInput: unknown,
  options?: AssistantOrchestratorOptions,
): Promise<AssistantTurnExecutionResult> {
  const parsed = coachTurnSchema.safeParse(rawInput);

  if (!isCoachEngineEnabled() || !parsed.success) {
    return runMockAssistantTurn(userId, rawInput, options);
  }

  return runCoachTurn(userId, parsed.data, rawInput, options);
}

function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function emit(
  options: AssistantOrchestratorOptions | undefined,
  event: AssistantStreamEvent,
): Promise<void> {
  await options?.onEvent?.(event);
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((block) =>
      typeof block === "object" &&
      block !== null &&
      typeof (block as { text?: unknown }).text === "string"
        ? (block as { text: string }).text
        : "",
    )
    .join("\n");
}

/** Earlier turns of the session as chat messages, oldest first. */
export function historyMessagesFrom(rows: ChatMessageRow[]): ToolChatMessage[] {
  const messages: ToolChatMessage[] = [];

  for (const row of rows.slice(-HISTORY_MESSAGE_LIMIT)) {
    if (row.role === "user") {
      const text = textOf(row.content);

      if (text !== "") {
        messages.push({ role: "user", content: text });
      }
    } else if (row.role === "assistant") {
      const answer = (
        row.structured_output as { answer?: AssistantStructuredAnswer } | null
      )?.answer;
      const text =
        answer === undefined
          ? textOf(row.content)
          : answerToHistoryText(answer);

      if (text !== "") {
        messages.push({ role: "assistant", content: text });
      }
    }
  }

  return messages;
}

async function resolveSession(
  userId: string,
  input: CoachTurnInput,
): Promise<string> {
  if (input.session_id === undefined) {
    const session = await createChatSession({
      userId,
      title: input.message.slice(0, 200),
    });

    return session.id;
  }

  const session = await findChatSessionByIdForUser(input.session_id, userId);

  if (session === null) {
    throw new HttpError(404, "NOT_FOUND", "Chat session was not found.");
  }

  return session.id;
}

function answerChunks(answer: AssistantStructuredAnswer): string[] {
  const text = answerToHistoryText(answer);
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += ANSWER_DELTA_CHUNK_SIZE) {
    chunks.push(text.slice(index, index + ANSWER_DELTA_CHUNK_SIZE));
  }

  return chunks;
}

async function finishTurn(input: {
  userId: string;
  sessionId: string;
  message: string;
  answer: AssistantStructuredAnswer;
  runs: CoachToolRun[];
  llmCalls: AssistantLlmCallRecord[];
  checkFaithfulness: boolean;
  options: AssistantOrchestratorOptions | undefined;
}): Promise<AssistantTurnExecutionResult> {
  const { answer, options } = input;
  const faithfulness = input.checkFaithfulness
    ? verifyAnswerFaithfulness(
        answer,
        input.runs.filter((run) => run.ok).map((run) => run.output),
      )
    : undefined;
  const response: MockAssistantTurnResponseData = {
    session_id: input.sessionId,
    mode: "auto",
    assistant_type: "coach",
    intent: answer.intent,
    tool_calls: input.runs.map((run) => ({
      tool_name: run.name,
      status: run.ok ? "success" : "error",
      duration_ms: 0,
    })),
    answer,
    ...(faithfulness === undefined ? {} : { faithfulness }),
  };

  await emit(options, { type: "state", state: "answering" });

  for (const chunk of answerChunks(answer)) {
    await emit(options, { type: "answer_delta", text: chunk });
  }

  await createChatMessage({
    sessionId: input.sessionId,
    role: "user",
    content: [{ type: "text", text: input.message }],
    structuredOutput: null,
    usage: null,
    metadata: { mode: "auto", engine: "coach" },
  });
  const assistantMessage = await createChatMessage({
    sessionId: input.sessionId,
    role: "assistant",
    content: [{ type: "text", text: answerToHistoryText(answer) }],
    structuredOutput: response,
    usage: null,
    metadata: {
      assistant_type: "coach",
      mode: "auto",
      tool_names: answer.evidence.tool_names,
    },
  });
  const withId = { ...response, message_id: assistantMessage.id };

  await emit(options, { type: "structured_output", output: withId });
  await emit(options, {
    type: "done",
    message_id: assistantMessage.id,
    session_id: input.sessionId,
  });

  return {
    response: withId,
    telemetry: { llm: summarizeTurnLlmCalls(input.llmCalls) },
  };
}

async function runTool(
  userId: string,
  name: string,
  rawArguments: string,
): Promise<CoachToolRun> {
  let args: unknown;

  try {
    args = JSON.parse(rawArguments === "" ? "{}" : rawArguments);
  } catch {
    return {
      name,
      args: rawArguments,
      ok: false,
      output: { error: "arguments are not valid JSON" },
    };
  }

  try {
    return {
      name,
      args,
      ok: true,
      output: await executeAiTool({ userId }, name, args),
    };
  } catch (error) {
    const issues = (error as { issues?: unknown }).issues;

    return {
      name,
      args,
      ok: false,
      output: {
        error: error instanceof Error ? error.message : "tool failed",
        ...(issues === undefined ? {} : { issues }),
      },
    };
  }
}

async function runCoachTurn(
  userId: string,
  input: CoachTurnInput,
  rawInput: unknown,
  options: AssistantOrchestratorOptions | undefined,
): Promise<AssistantTurnExecutionResult> {
  // Requests over the per-IP real-provider cap keep the deterministic path.
  if (options?.assistantIpGuardDecision?.kind === "fallback") {
    return runMockAssistantTurn(userId, rawInput, options);
  }

  const safety = isAssistantSafetyGateEnabled()
    ? classifyAssistantSafety(input.message)
    : null;
  const medical =
    safety !== null &&
    safety.boundary === "medical_boundary" &&
    safety.reason !== null;
  const guard = options?.providerGuard ?? getDefaultAssistantProviderGuard();

  // Decide the budget before anything is written or streamed, so a denied
  // turn can still be handed to the deterministic pipeline cleanly. Safety
  // redirects never call the model and do not spend budget.
  if (!medical && guard.guardRealProviderAttempt().kind === "fallback") {
    return runMockAssistantTurn(userId, rawInput, options);
  }

  await emit(options, { type: "state", state: "thinking" });
  const sessionId = await resolveSession(userId, input);
  await emit(options, { type: "session", session_id: sessionId });

  if (medical) {
    return finishTurn({
      userId,
      sessionId,
      message: input.message,
      answer: composeMedicalSafetyAnswer(safety),
      runs: [],
      llmCalls: [],
      checkFaithfulness: false,
      options,
    });
  }

  const config = getOpenAiCompatibleProviderConfig();
  await emit(options, {
    type: "provider_selected",
    provider: "openai_compatible",
  });

  const timeZone = input.timezone ?? FALLBACK_TIME_ZONE;
  const history = historyMessagesFrom(
    await listMessagesForSession(sessionId, userId),
  );
  const messages: ToolChatMessage[] = [
    {
      role: "system",
      content: buildCoachSystemPrompt({ today: todayIn(timeZone), timeZone }),
    },
    ...history,
    { role: "user", content: input.message },
  ];
  const runs: CoachToolRun[] = [];
  const llmCalls: AssistantLlmCallRecord[] = [];
  let finalText: string | null = null;

  for (let call = 0; call < MAX_MODEL_CALLS && finalText === null; call += 1) {
    if (call > 0 && guard.guardRealProviderAttempt().kind === "fallback") {
      break;
    }

    const lastCall = call === MAX_MODEL_CALLS - 1;
    const result: ToolChatResult = await runOpenAiCompatibleToolChat(
      {
        messages,
        tools: COACH_TOOL_SPECS,
        toolChoice: lastCall ? "none" : "auto",
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
      },
      config,
      { timeoutMs: MODEL_CALL_TIMEOUT_MS },
    );
    const record: AssistantLlmCallRecord = {
      attempted: result.attempted,
      errored: !result.ok,
      provider: config.provider,
      model: result.model,
      usage: result.usage,
    };

    llmCalls.push(record);
    guard.recordCost(estimateAssistantProviderCallCostUsd(record));

    if (!result.ok) {
      // A failed first call falls back to the deterministic pipeline, matching
      // the legacy provider-error behaviour; later failures end the loop.
      if (runs.length === 0) {
        return runMockAssistantTurn(userId, rawInput, options);
      }

      break;
    }

    if (result.toolCalls.length === 0) {
      finalText = result.content?.trim() ?? "";
      break;
    }

    messages.push({
      role: "assistant",
      content: result.content,
      tool_calls: result.toolCalls,
    });
    await emit(options, { type: "state", state: "tool_calling" });

    for (const toolCall of result.toolCalls) {
      await emit(options, {
        type: "tool_call_started",
        tool_name: toolCall.name,
      });
      const startedAt = Date.now();
      const run = await runTool(userId, toolCall.name, toolCall.arguments);

      runs.push(run);
      await emit(options, {
        type: "tool_call_finished",
        tool_name: toolCall.name,
        status: run.ok ? "success" : "error",
        duration_ms: Date.now() - startedAt,
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: compactToolOutputForModel(run.output),
      });
    }
  }

  const text =
    finalText === null || finalText === ""
      ? "这次没能完成分析，请稍后再试，或换个更具体的问法。"
      : finalText;

  return finishTurn({
    userId,
    sessionId,
    message: input.message,
    answer: buildCoachAnswer(text, runs),
    runs,
    llmCalls,
    checkFaithfulness: true,
    options,
  });
}
