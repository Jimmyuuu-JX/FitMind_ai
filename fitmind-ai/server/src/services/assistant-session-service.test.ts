import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findChatSessionByIdForUser: vi.fn(),
  listMessagesForSession: vi.fn(),
}));

vi.mock("../db/chat-repository.js", () => repo);

const { getAssistantSessionMessages } =
  await import("./assistant-session-service.js");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAssistantSessionMessages", () => {
  it("returns user and assistant messages oldest first, without tool rows", async () => {
    repo.findChatSessionByIdForUser.mockResolvedValueOnce({ id: SESSION_ID });
    repo.listMessagesForSession.mockResolvedValueOnce([
      {
        id: "m1",
        role: "user",
        content: [{ type: "text", text: "我卧推最近怎么样" }],
        structured_output: null,
        created_at: new Date("2026-11-20T10:00:00.000Z"),
      },
      {
        id: "m2",
        role: "tool",
        content: [],
        structured_output: null,
        created_at: "2026-11-20T10:00:01.000Z",
      },
      {
        id: "m3",
        role: "assistant",
        content: [{ type: "text", text: "卧推持平" }],
        structured_output: { answer: { summary: "卧推持平" } },
        usage: { total_tokens: 10 },
        metadata: { tool_names: ["get_exercise_progress"] },
        created_at: "2026-11-20T10:00:05.000Z",
      },
    ]);

    const result = await getAssistantSessionMessages({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(repo.findChatSessionByIdForUser).toHaveBeenCalledWith(
      SESSION_ID,
      USER_ID,
    );
    expect(repo.listMessagesForSession).toHaveBeenCalledWith(
      SESSION_ID,
      USER_ID,
    );
    expect(result).toEqual({
      session_id: SESSION_ID,
      messages: [
        {
          id: "m1",
          role: "user",
          text: "我卧推最近怎么样",
          created_at: "2026-11-20T10:00:00.000Z",
        },
        {
          id: "m3",
          role: "assistant",
          text: "卧推持平",
          created_at: "2026-11-20T10:00:05.000Z",
          structured_output: {
            answer: { summary: "卧推持平" },
            message_id: "m3",
          },
        },
      ],
    });
  });

  it("answers a session the user does not own exactly like a missing one", async () => {
    repo.findChatSessionByIdForUser.mockResolvedValueOnce(null);

    await expect(
      getAssistantSessionMessages({ sessionId: SESSION_ID, userId: USER_ID }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Chat session was not found.",
    });
    expect(repo.listMessagesForSession).not.toHaveBeenCalled();
  });

  it("returns null structure when an assistant row stored none", async () => {
    repo.findChatSessionByIdForUser.mockResolvedValueOnce({ id: SESSION_ID });
    repo.listMessagesForSession.mockResolvedValueOnce([
      {
        id: "m4",
        role: "assistant",
        content: "not blocks",
        structured_output: null,
        created_at: "t",
      },
    ]);

    const result = await getAssistantSessionMessages({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(result.messages).toEqual([
      {
        id: "m4",
        role: "assistant",
        text: "",
        created_at: "t",
        structured_output: null,
      },
    ]);
  });
});
