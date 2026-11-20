/** Anthropic model used when `ANTHROPIC_MODEL` is unset. */
export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Resolve the Anthropic model for the assistant and intake adapters.
 *
 * @param configured - The trimmed `ANTHROPIC_MODEL` value, if any.
 * @returns The configured model, or the default when unset.
 */
export function resolveAnthropicModel(configured: string | undefined): string {
  return configured ?? ANTHROPIC_DEFAULT_MODEL;
}
