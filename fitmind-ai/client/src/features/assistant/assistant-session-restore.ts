import type { AssistantSessionMessages } from "./assistant-session-api";
import { mergeStructuredOutputIntoMessage } from "./assistant-structured-output";
import type { AssistantChatMessage } from "./assistant-types";

/**
 * Rebuilds chat bubbles from a stored session, the same way a live turn
 * fills them: text first, then the structured output merged on top.
 *
 * @param session - Messages read back from the server.
 * @returns Chat messages in display order.
 */
export function restoreAssistantChatMessages(
  session: AssistantSessionMessages,
): AssistantChatMessage[] {
  return session.messages.flatMap((message): AssistantChatMessage[] => {
    if (message.role === "user") {
      return [
        { id: `restored-${message.id}`, role: "user", text: message.text },
      ];
    }

    const base: AssistantChatMessage = {
      id: `restored-${message.id}`,
      messageId: message.id,
      role: "assistant",
      text: message.text,
    };

    return message.structured_output === null
      ? [base]
      : mergeStructuredOutputIntoMessage(
          [base],
          base.id,
          message.structured_output,
        );
  });
}
