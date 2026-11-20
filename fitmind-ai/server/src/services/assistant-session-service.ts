import {
  findChatSessionByIdForUser,
  listMessagesForSession,
  type ChatMessageRow,
} from "../db/chat-repository.js";
import { HttpError } from "../utils/http-error.js";

/** One restored chat message; mirrors `shared/src/assistant-session.ts`. */
export type AssistantSessionMessageDto =
  | {
      id: string;
      role: "user";
      text: string;
      created_at: string;
    }
  | {
      id: string;
      role: "assistant";
      text: string;
      created_at: string;
      structured_output: Record<string, unknown> | null;
    };

export interface AssistantSessionMessagesDto {
  session_id: string;
  messages: AssistantSessionMessageDto[];
}

export interface GetAssistantSessionMessagesInput {
  sessionId: string;
  userId: string;
}

/**
 * Read back one user-owned chat session for the coach page.
 *
 * @param input - Session id and the authenticated user id.
 * @returns The session's user and assistant messages, oldest first.
 * @throws HttpError 404 when the session is absent or owned by someone else;
 * both cases share one response so callers cannot probe for foreign sessions.
 */
export async function getAssistantSessionMessages(
  input: GetAssistantSessionMessagesInput,
): Promise<AssistantSessionMessagesDto> {
  const session = await findChatSessionByIdForUser(
    input.sessionId,
    input.userId,
  );

  if (session === null) {
    throw new HttpError(404, "NOT_FOUND", "Chat session was not found.");
  }

  const rows = await listMessagesForSession(session.id, input.userId);

  return {
    session_id: session.id,
    messages: rows.flatMap(mapMessageRow),
  };
}

function mapMessageRow(row: ChatMessageRow): AssistantSessionMessageDto[] {
  const createdAt = toIsoTimestamp(row.created_at);
  const text = readTextBlocks(row.content);

  if (row.role === "user") {
    return [{ id: row.id, role: "user", text, created_at: createdAt }];
  }

  if (row.role === "assistant") {
    return [
      {
        id: row.id,
        role: "assistant",
        text,
        created_at: createdAt,
        structured_output: withMessageId(row.structured_output, row.id),
      },
    ];
  }

  return [];
}

/**
 * Join the text blocks of a persisted `content` value.
 *
 * @param content - JSONB content column; expected to be `[{type:"text",text}]`.
 * @returns Concatenated text, or an empty string when no text block exists.
 */
function readTextBlocks(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((block: unknown) => {
      if (
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return [block.text];
      }

      return [];
    })
    .join("\n");
}

/**
 * Restore `message_id` on the stored structure.
 *
 * @remarks
 * The orchestrator persists the response before the row id exists and only
 * then sets `message_id` on the copy it streams, so the stored JSON lacks it.
 * Putting the row id back makes the restored structure match the one the
 * client originally received. A missing or non-object value becomes `null`.
 */
function withMessageId(
  structuredOutput: unknown,
  messageId: string,
): Record<string, unknown> | null {
  if (
    typeof structuredOutput !== "object" ||
    structuredOutput === null ||
    Array.isArray(structuredOutput)
  ) {
    return null;
  }

  return { ...structuredOutput, message_id: messageId };
}

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}
