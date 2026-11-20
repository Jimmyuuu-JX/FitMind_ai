/**
 * `GET /api/assistant/sessions/:id/messages` response contract.
 *
 * @remarks
 * The server cannot import this package (its `rootDir` is `server/src`), so
 * `server/src/services/assistant-session-service.ts` keeps a mirror of these
 * types. Change both together.
 */

/** One persisted user turn. */
export interface AssistantSessionUserMessageDto {
  id: string;
  role: "user";
  text: string;
  created_at: string;
}

/** One persisted assistant turn, with the structure the stream last emitted. */
export interface AssistantSessionAssistantMessageDto {
  id: string;
  role: "assistant";
  text: string;
  created_at: string;
  /** The final `structured_output` event payload, or null when none was stored. */
  structured_output: Record<string, unknown> | null;
}

export type AssistantSessionMessageDto =
  | AssistantSessionUserMessageDto
  | AssistantSessionAssistantMessageDto;

export interface AssistantSessionMessagesDto {
  session_id: string;
  /** Oldest first. `tool` rows are never returned. */
  messages: AssistantSessionMessageDto[];
}
