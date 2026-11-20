import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ToolChatRequest,
  ToolChatResult,
} from "../ai/openai-compatible-tool-chat.js";
import type {
  AssistantProviderGuard,
  AssistantProviderGuardDecision,
} from "./assistant-provider-guard.js";
import type { AssistantStreamEvent } from "./assistant-stream-types.js";

const env = {
  assistantEngine: "coach" as "coach" | "legacy",
  assistantProvider: "openai_compatible" as string,
  assistantSafetyGate: true,
};

vi.mock("../../env.js", () => ({ loadServerEnv: () => env }));

const chatRepo = vi.hoisted(() => ({
  createChatSession: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
  })),
  findChatSessionByIdForUser: vi.fn(
    async (): Promise<{ id: string } | null> => ({
      id: "22222222-2222-4222-8222-222222222222",
    }),
  ),
  listMessagesForSession: vi.fn(async (): Promise<unknown[]> => []),
  createChatMessage: vi.fn(async () => ({
    id: "33333333-3333-4333-8333-333333333333",
  })),
}));

vi.mock("../../db/chat-repository.js", () => chatRepo);

vi.mock("../ai/openai-compatible-provider-config.js", () => ({
  getOpenAiCompatibleProviderConfig: () => ({
    provider: "openai_compatible",
    baseUrl: "https://example.test",
    apiKey: "test-key",
    model: "test-model",
  }),
}));

const toolChat = vi.hoisted(() => ({
  runOpenAiCompatibleToolChat:
    vi.fn<(request: ToolChatRequest) => Promise<ToolChatResult>>(),
}));

vi.mock("../ai/openai-compatible-tool-chat.js", () => toolChat);

const executor = vi.hoisted(() => ({
  executeAiTool:
    vi.fn<
      (context: unknown, name: string, args: unknown) => Promise<unknown>
    >(),
}));

vi.mock("../ai/tools/tool-executor.js", () => executor);

const legacy = vi.hoisted(() => ({
  runMockAssistantTurn: vi.fn(async () => ({
    response: { legacy: true },
    telemetry: {},
  })),
}));

vi.mock("./assistant-orchestrator-service.js", () => legacy);

const { runAssistantTurn } = await import("./coach-turn-service.js");

function guard(
  decisions: Array<"allow" | "fallback">,
): AssistantProviderGuard & {
  attempts: number;
} {
  const queue = [...decisions];
  const telemetry = {
    budget_scope: "instance" as const,
    budget_current_calls: 0,
    budget_call_limit: 1,
    budget_current_cost_usd: 0,
    budget_cost_limit_usd: 1,
  };

  return {
    attempts: 0,
    guardRealProviderAttempt(): AssistantProviderGuardDecision {
      this.attempts += 1;
      const next = queue.shift() ?? "allow";

      return next === "allow"
        ? {
            kind: "allow",
            telemetry: {
              ...telemetry,
              budget_fallback: false,
              budget_reason: null,
            },
          }
        : {
            kind: "fallback",
            fallback_provider: "mock",
            telemetry: {
              ...telemetry,
              budget_fallback: true,
              budget_reason: "daily_call_budget_exceeded",
            },
          };
    },
    recordCost: vi.fn(),
  };
}

function reply(partial: Partial<ToolChatResult>): ToolChatResult {
  return {
    attempted: true,
    ok: true,
    status: 200,
    model: "test-model",
    content: null,
    toolCalls: [],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...partial,
  };
}

const BENCH_ID = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  env.assistantEngine = "coach";
  env.assistantProvider = "openai_compatible";
});

describe("runAssistantTurn routing", () => {
  it("keeps the legacy pipeline unless the coach engine is selected", async () => {
    env.assistantEngine = "legacy";

    await runAssistantTurn("u1", { mode: "auto", message: "卧推怎么样" });

    expect(legacy.runMockAssistantTurn).toHaveBeenCalledOnce();
    expect(toolChat.runOpenAiCompatibleToolChat).not.toHaveBeenCalled();
  });

  it("keeps the legacy pipeline for structured requests", async () => {
    await runAssistantTurn("u1", {
      mode: "training_overview",
      message: "最近训练总览",
    });
    await runAssistantTurn("u1", {
      mode: "auto",
      message: "卧推",
      exercise_id: BENCH_ID,
    });

    expect(legacy.runMockAssistantTurn).toHaveBeenCalledTimes(2);
    expect(toolChat.runOpenAiCompatibleToolChat).not.toHaveBeenCalled();
  });
});

describe("coach turn", () => {
  it("runs tools the model asks for, feeds results back, and answers from them", async () => {
    toolChat.runOpenAiCompatibleToolChat
      .mockResolvedValueOnce(
        reply({
          toolCalls: [
            {
              id: "c1",
              name: "get_exercise_progress",
              arguments: `{"exercise_id":"${BENCH_ID}"}`,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        reply({ content: "卧推最好 77.5kg\n- 已经持平四周" }),
      );
    executor.executeAiTool.mockResolvedValue({ best_weight_kg: 77.5 });
    const events: AssistantStreamEvent[] = [];
    const testGuard = guard(["allow", "allow"]);

    const result = await runAssistantTurn(
      "u1",
      { mode: "auto", message: "我卧推最近怎么样" },
      { providerGuard: testGuard, onEvent: (event) => void events.push(event) },
    );

    expect(executor.executeAiTool).toHaveBeenCalledWith(
      { userId: "u1" },
      "get_exercise_progress",
      {
        exercise_id: BENCH_ID,
      },
    );
    const secondRequest =
      toolChat.runOpenAiCompatibleToolChat.mock.calls[1]![0];
    expect(secondRequest.messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "c1",
      content: '{"best_weight_kg":77.5}',
    });
    expect(result.response).toMatchObject({
      assistant_type: "coach",
      answer: {
        summary: "卧推最好 77.5kg",
        bullets: ["已经持平四周"],
        intent: "progress",
      },
      faithfulness: { status: "verified" },
    });
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "session",
        "tool_call_started",
        "tool_call_finished",
        "answer_delta",
        "structured_output",
        "done",
      ]),
    );
    expect(chatRepo.createChatMessage).toHaveBeenCalledTimes(2);
    expect(testGuard.attempts).toBe(2);
    expect(testGuard.recordCost).toHaveBeenCalledTimes(2);
  });

  it("flags numbers the tools did not return", async () => {
    toolChat.runOpenAiCompatibleToolChat.mockResolvedValueOnce(
      reply({ content: "你的卧推已经 82.5kg" }),
    );

    const result = await runAssistantTurn(
      "u1",
      { mode: "auto", message: "我卧推最近怎么样" },
      { providerGuard: guard(["allow"]) },
    );

    expect(result.response).toMatchObject({
      faithfulness: { status: "flagged" },
    });
  });

  it("sends earlier turns of the session as history", async () => {
    chatRepo.listMessagesForSession.mockResolvedValueOnce([
      {
        role: "user",
        content: [{ type: "text", text: "我卧推最近怎么样" }],
        structured_output: null,
      },
      {
        role: "assistant",
        content: [],
        structured_output: {
          answer: {
            summary: "卧推持平",
            bullets: ["77.5kg"],
            recommendation: "",
          },
        },
      },
    ]);
    toolChat.runOpenAiCompatibleToolChat.mockResolvedValueOnce(
      reply({ content: "划船在进步" }),
    );

    await runAssistantTurn(
      "u1",
      {
        mode: "auto",
        message: "那划船呢",
        session_id: "22222222-2222-4222-8222-222222222222",
      },
      { providerGuard: guard(["allow"]) },
    );

    const messages =
      toolChat.runOpenAiCompatibleToolChat.mock.calls[0]![0].messages;
    expect(messages.slice(1)).toEqual([
      { role: "user", content: "我卧推最近怎么样" },
      { role: "assistant", content: "卧推持平\n- 77.5kg" },
      { role: "user", content: "那划船呢" },
    ]);
  });

  it("answers another user's session id with the same not-found error", async () => {
    chatRepo.findChatSessionByIdForUser.mockResolvedValueOnce(null);

    await expect(
      runAssistantTurn(
        "u1",
        {
          mode: "auto",
          message: "继续",
          session_id: "55555555-5555-4555-8555-555555555555",
        },
        { providerGuard: guard(["allow"]) },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(toolChat.runOpenAiCompatibleToolChat).not.toHaveBeenCalled();
  });

  it("hands the turn to the deterministic pipeline when the budget is spent", async () => {
    const testGuard = guard(["fallback"]);

    await runAssistantTurn(
      "u1",
      { mode: "auto", message: "我卧推最近怎么样" },
      { providerGuard: testGuard },
    );

    expect(legacy.runMockAssistantTurn).toHaveBeenCalledOnce();
    expect(toolChat.runOpenAiCompatibleToolChat).not.toHaveBeenCalled();
    expect(chatRepo.createChatSession).not.toHaveBeenCalled();
  });

  it("hands the turn to the deterministic pipeline when the per-IP cap is reached", async () => {
    await runAssistantTurn(
      "u1",
      { mode: "auto", message: "我卧推最近怎么样" },
      {
        providerGuard: guard(["allow"]),
        assistantIpGuardDecision: {
          kind: "fallback",
          fallback_provider: "mock",
        } as never,
      },
    );

    expect(legacy.runMockAssistantTurn).toHaveBeenCalledOnce();
    expect(toolChat.runOpenAiCompatibleToolChat).not.toHaveBeenCalled();
  });

  it("falls back to the deterministic pipeline when the first model call fails", async () => {
    toolChat.runOpenAiCompatibleToolChat.mockResolvedValueOnce(
      reply({ ok: false, status: 500 }),
    );

    await runAssistantTurn(
      "u1",
      { mode: "auto", message: "我卧推最近怎么样" },
      { providerGuard: guard(["allow"]) },
    );

    expect(legacy.runMockAssistantTurn).toHaveBeenCalledOnce();
  });

  it("answers medical questions without calling the model or spending budget", async () => {
    const testGuard = guard([]);

    const result = await runAssistantTurn(
      "u1",
      { mode: "auto", message: "膝盖受伤了吃什么止痛药比较好" },
      { providerGuard: testGuard },
    );

    expect(toolChat.runOpenAiCompatibleToolChat).not.toHaveBeenCalled();
    expect(testGuard.attempts).toBe(0);
    expect(result.response).toMatchObject({
      answer: { intent: "unsupported" },
    });
  });

  it("stops calling tools after the step limit and forces a text answer", async () => {
    toolChat.runOpenAiCompatibleToolChat.mockImplementation(async (request) =>
      request.toolChoice === "none"
        ? reply({ content: "已有的数据显示卧推持平" })
        : reply({
            toolCalls: [
              { id: "c", name: "get_training_summary", arguments: "{}" },
            ],
          }),
    );
    executor.executeAiTool.mockResolvedValue({});

    await runAssistantTurn(
      "u1",
      { mode: "auto", message: "全面分析一下" },
      { providerGuard: guard([]) },
    );

    const calls = toolChat.runOpenAiCompatibleToolChat.mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls.at(-1)![0].toolChoice).toBe("none");
    expect(
      calls.slice(0, -1).every(([request]) => request.toolChoice === "auto"),
    ).toBe(true);
  });

  it("returns tool argument errors to the model instead of failing the turn", async () => {
    toolChat.runOpenAiCompatibleToolChat
      .mockResolvedValueOnce(
        reply({
          toolCalls: [
            { id: "c1", name: "get_training_summary", arguments: "not json" },
          ],
        }),
      )
      .mockResolvedValueOnce(reply({ content: "需要具体的日期范围" }));

    await runAssistantTurn(
      "u1",
      { mode: "auto", message: "总结一下" },
      { providerGuard: guard([]) },
    );

    expect(executor.executeAiTool).not.toHaveBeenCalled();
    const toolMessage =
      toolChat.runOpenAiCompatibleToolChat.mock.calls[1]![0].messages.at(-1);
    expect(toolMessage).toMatchObject({ role: "tool", tool_call_id: "c1" });
    expect(JSON.parse((toolMessage as { content: string }).content)).toEqual({
      error: "arguments are not valid JSON",
    });
  });
});
