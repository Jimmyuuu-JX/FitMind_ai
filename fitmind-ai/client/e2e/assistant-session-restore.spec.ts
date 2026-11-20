import { expect, test } from "@playwright/test";

import { installApiMocks } from "./support/mock-api";

const SESSION_ID = "cccc3333-3333-4333-8333-333333333333";
const QUESTION = "我卧推最近怎么样";
const ANSWER = "杠铃卧推这四周停在 77.5 公斤。";

function sse(type: string, payload: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

const structuredOutput = {
  message_id: "msg-1",
  intent: "progress",
  answer: {
    summary: ANSWER,
    bullets: [],
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
};

test("a conversation survives a reload and 新对话 starts over", async ({
  page,
}) => {
  await installApiMocks(page, { authenticated: true });

  const sessionReads: string[] = [];

  await page.route("**/api/assistant/stream-turn**", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      status: 200,
      body: [
        sse("session", { session_id: SESSION_ID }),
        sse("answer_delta", { text: ANSWER }),
        sse("structured_output", { output: structuredOutput }),
        sse("done", { message_id: "msg-1", session_id: SESSION_ID }),
      ].join(""),
    }),
  );
  await page.route("**/api/assistant/sessions/*/messages", (route) => {
    sessionReads.push(new URL(route.request().url()).pathname);

    return route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ok: true,
        data: {
          session_id: SESSION_ID,
          messages: [
            {
              id: "msg-0",
              role: "user",
              text: QUESTION,
              created_at: "2026-11-20T10:00:00.000Z",
            },
            {
              id: "msg-1",
              role: "assistant",
              text: ANSWER,
              created_at: "2026-11-20T10:00:05.000Z",
              structured_output: structuredOutput,
            },
          ],
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "AI 助手" }).click();
  await page.getByRole("textbox").last().fill(QUESTION);
  await page.getByRole("button", { name: "发送追问" }).click();
  await expect(page.getByText(ANSWER).first()).toBeVisible();
  expect(sessionReads).toHaveLength(0);

  await page.reload();
  await page.getByRole("button", { name: "AI 助手" }).click();

  await expect(page.getByText(QUESTION).first()).toBeVisible();
  await expect(page.getByText(ANSWER).first()).toBeVisible();
  // Dev StrictMode may start the read twice and abort the first one.
  expect(sessionReads.length).toBeGreaterThan(0);
  expect(new Set(sessionReads)).toEqual(
    new Set([`/api/assistant/sessions/${SESSION_ID}/messages`]),
  );
  const readsBeforeNewConversation = sessionReads.length;

  await page.getByRole("button", { name: "新对话" }).click();
  await expect(page.getByText(ANSWER)).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "AI 助手" }).click();
  await expect(page.getByRole("button", { name: "发送追问" })).toBeVisible();
  await expect(page.getByText(ANSWER)).toHaveCount(0);
  // 新对话 forgot the session, so the next load reads nothing back.
  expect(sessionReads).toHaveLength(readsBeforeNewConversation);
});
