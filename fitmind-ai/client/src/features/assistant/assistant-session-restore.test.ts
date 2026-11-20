import { describe, expect, it } from "vitest";

import { restoreAssistantChatMessages } from "./assistant-session-restore";

describe("restoreAssistantChatMessages", () => {
  it("rebuilds user and assistant bubbles, merging the stored structure", () => {
    const messages = restoreAssistantChatMessages({
      session_id: "s1",
      messages: [
        { id: "m1", role: "user", text: "我卧推最近怎么样", created_at: "t1" },
        {
          id: "m2",
          role: "assistant",
          text: "卧推持平\n- 77.5kg",
          created_at: "t2",
          structured_output: {
            message_id: "m2",
            intent: "progress",
            faithfulness: {
              status: "verified",
              checkedNumbers: 1,
              unverifiedClaims: [],
            },
            answer: {
              summary: "卧推持平",
              bullets: ["77.5kg"],
              limitations: [],
              sources: [],
              evidence: {
                source: "deterministic_tool_executor",
                tool_names: ["get_exercise_progress"],
                workout_ids: ["w1"],
                set_ids: [],
                calculation_rules: [],
              },
            },
          } as never,
        },
        {
          id: "m3",
          role: "assistant",
          text: "旧答案",
          created_at: "t3",
          structured_output: null,
        },
      ],
    });

    expect(
      messages.map((message) => [
        message.role,
        message.text,
        message.messageId,
      ]),
    ).toEqual([
      ["user", "我卧推最近怎么样", undefined],
      ["assistant", "卧推持平\n- 77.5kg", "m2"],
      ["assistant", "旧答案", "m3"],
    ]);
    expect(messages[1]).toMatchObject({
      intent: "progress",
      faithfulness: { status: "verified" },
    });
    expect(
      messages[1]?.evidence?.toolNames ?? messages[1]?.evidence,
    ).toBeTruthy();
    expect(new Set(messages.map((message) => message.id)).size).toBe(3);
  });
});
