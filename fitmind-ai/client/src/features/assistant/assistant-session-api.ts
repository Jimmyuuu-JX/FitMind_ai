import { HttpClientError, requestJson } from "../../services/http-client";
import type { AssistantStructuredOutput } from "./assistant-types";

export type AssistantSessionMessage =
  | { id: string; role: "user"; text: string; created_at: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      created_at: string;
      structured_output: AssistantStructuredOutput | null;
    };

export interface AssistantSessionMessages {
  session_id: string;
  messages: AssistantSessionMessage[];
}

/**
 * Reads back one of the user's coach sessions.
 *
 * @param sessionId - Remembered session id.
 * @param options - Auth token and abort signal.
 * @returns The session messages, or null when the session no longer exists
 *   for this user.
 */
export async function fetchAssistantSessionMessages(
  sessionId: string,
  options: { token: string | null; signal?: AbortSignal | undefined },
): Promise<AssistantSessionMessages | null> {
  try {
    return await requestJson<AssistantSessionMessages>(
      `/api/assistant/sessions/${encodeURIComponent(sessionId)}/messages`,
      { token: options.token, signal: options.signal },
    );
  } catch (error) {
    if (
      error instanceof HttpClientError &&
      (error.status === 404 || error.status === 400)
    ) {
      return null;
    }

    throw error;
  }
}
