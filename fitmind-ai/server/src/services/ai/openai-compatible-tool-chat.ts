import { z } from "zod";

import { CHAT_COMPLETION_TIMEOUT_MS } from "./openai-compatible-chat-client.js";
import type { OpenAiCompatibleProviderConfig } from "./openai-compatible-provider-config.js";
import type { AssistantProviderUsage } from "./provider-types.js";

/** A tool the model may call, described with a JSON Schema object. */
export interface ToolChatToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolChatToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Conversation messages in OpenAI chat-completions shape. */
export type ToolChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolChatToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolChatRequest {
  messages: ToolChatMessage[];
  tools: ToolChatToolSpec[];
  /** `none` forces a text answer, used when the step budget is spent. */
  toolChoice: "auto" | "none";
  maxTokens: number;
  temperature: number;
}

export interface ToolChatResult {
  /** True once a network request was issued. */
  attempted: boolean;
  ok: boolean;
  status: number;
  model: string;
  content: string | null;
  toolCalls: ToolChatToolCall[];
  usage?: AssistantProviderUsage | undefined;
  /** Never contains the API key or request headers. */
  errorMessage?: string | undefined;
}

const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
});

const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

function toWireMessage(message: ToolChatMessage): Record<string, unknown> {
  if (message.role !== "assistant" || message.tool_calls === undefined) {
    return message;
  }

  return {
    role: "assistant",
    content: message.content,
    tool_calls: message.tool_calls.map((call) => ({
      id: call.id,
      type: "function",
      function: { name: call.name, arguments: call.arguments },
    })),
  };
}

/**
 * Runs one chat-completions call that may return several tool calls.
 *
 * Unlike the single-call client, it accepts assistant and tool messages, so a
 * caller can feed tool results back and loop. It never throws on network,
 * HTTP or shape failures; the result says what happened.
 *
 * @param request - Messages, tools and sampling settings.
 * @param config - Provider endpoint, key and model.
 * @param options - Optional timeout override.
 * @returns The normalized result.
 */
export async function runOpenAiCompatibleToolChat(
  request: ToolChatRequest,
  config: OpenAiCompatibleProviderConfig,
  options: { timeoutMs?: number | undefined } = {},
): Promise<ToolChatResult> {
  const timeoutMs = options.timeoutMs ?? CHAT_COMPLETION_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const base = { model: config.model, content: null, toolCalls: [] };
  let response: Response;

  try {
    response = await fetch(
      `${config.baseUrl.replace(/\/+$/u, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          messages: request.messages.map(toWireMessage),
          ...(request.tools.length === 0
            ? {}
            : {
                tools: request.tools.map((tool) => ({
                  type: "function",
                  function: tool,
                })),
                tool_choice: request.toolChoice,
              }),
        }),
        signal: controller.signal,
      },
    );
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";

    return {
      ...base,
      attempted: true,
      ok: false,
      status: 0,
      errorMessage: aborted
        ? `Model request timed out after ${timeoutMs}ms.`
        : "Model request failed before a response.",
    };
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const usage = usageSchema.safeParse(
    typeof payload === "object" && payload !== null
      ? (payload as { usage?: unknown }).usage
      : undefined,
  );
  const usageData = usage.success ? usage.data : undefined;

  if (!response.ok) {
    return {
      ...base,
      attempted: true,
      ok: false,
      status: response.status,
      usage: usageData,
      errorMessage: `Model request failed with HTTP ${response.status}.`,
    };
  }

  const parsed = responseSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ...base,
      attempted: true,
      ok: false,
      status: response.status,
      usage: usageData,
      errorMessage: "Model returned an unexpected response shape.",
    };
  }

  const message = parsed.data.choices[0]!.message;

  return {
    attempted: true,
    ok: true,
    status: response.status,
    model: config.model,
    content: message.content ?? null,
    toolCalls: (message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    })),
    usage: usageData,
  };
}
