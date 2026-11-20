import { describe, expect, it } from "vitest";

import { loadServerEnv } from "../../env.js";
import {
  ANTHROPIC_DEFAULT_MODEL,
  resolveAnthropicModel,
} from "./anthropic-model.js";

describe("resolveAnthropicModel", () => {
  it("uses ANTHROPIC_MODEL when it is set", () => {
    const env = loadServerEnv({
      ANTHROPIC_MODEL: "  claude-example-model \n",
    } as NodeJS.ProcessEnv);

    expect(resolveAnthropicModel(env.anthropicModel)).toBe(
      "claude-example-model",
    );
  });

  it("falls back to the default when ANTHROPIC_MODEL is unset or blank", () => {
    for (const value of [undefined, "", "   "]) {
      const env = loadServerEnv(
        (value === undefined
          ? {}
          : { ANTHROPIC_MODEL: value }) as NodeJS.ProcessEnv,
      );

      expect(resolveAnthropicModel(env.anthropicModel)).toBe(
        ANTHROPIC_DEFAULT_MODEL,
      );
    }
  });
});
