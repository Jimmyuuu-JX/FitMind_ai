import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearStoredAssistantSessionId,
  readStoredAssistantSessionId,
  storeAssistantSessionId,
} from "./assistant-session-storage";

function installStorage(store: Map<string, string>): void {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistant session storage", () => {
  it("keeps one session id per user", () => {
    installStorage(new Map());

    storeAssistantSessionId("user-a", "session-a");
    storeAssistantSessionId("user-b", "session-b");

    expect(readStoredAssistantSessionId("user-a")).toBe("session-a");
    expect(readStoredAssistantSessionId("user-b")).toBe("session-b");

    clearStoredAssistantSessionId("user-a");

    expect(readStoredAssistantSessionId("user-a")).toBeNull();
    expect(readStoredAssistantSessionId("user-b")).toBe("session-b");
  });

  it("treats blocked or missing storage as empty instead of throwing", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {
          throw new Error("SecurityError");
        },
      },
    });

    expect(() => storeAssistantSessionId("user-a", "s")).not.toThrow();
    expect(() => clearStoredAssistantSessionId("user-a")).not.toThrow();
    expect(readStoredAssistantSessionId("user-a")).toBeNull();
  });
});
