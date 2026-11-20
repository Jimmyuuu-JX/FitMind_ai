const KEY_PREFIX = "fitmind.assistant.session.";

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/**
 * Reads the coach session id remembered for this user on this device.
 *
 * @param userId - Authenticated user id; the key is per user so another
 *   account on the same browser never sees it.
 * @returns The session id, or null when none is stored or storage is unavailable.
 */
export function readStoredAssistantSessionId(userId: string): string | null {
  try {
    const value = window.localStorage.getItem(keyFor(userId));

    return value === null || value === "" ? null : value;
  } catch {
    return null;
  }
}

/**
 * Remembers the coach session id for this user on this device.
 *
 * @param userId - Authenticated user id.
 * @param sessionId - Session id returned by the stream.
 */
export function storeAssistantSessionId(
  userId: string,
  sessionId: string,
): void {
  try {
    window.localStorage.setItem(keyFor(userId), sessionId);
  } catch {
    // Storage may be blocked; the conversation still works for this page.
  }
}

/**
 * Forgets the remembered coach session for this user.
 *
 * @param userId - Authenticated user id.
 */
export function clearStoredAssistantSessionId(userId: string): void {
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
