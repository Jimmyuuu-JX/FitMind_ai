import type {
  AssistantAnswerSource,
  AssistantStructuredAnswer,
} from "./assistant-answer-composer.js";
import type { AssistantRoutedIntent } from "./assistant-intent-router.js";

/** One tool call the coach made in a turn, with the full result it received. */
export interface CoachToolRun {
  name: string;
  args: unknown;
  ok: boolean;
  output: unknown;
}

const BULLET_PREFIX = /^\s*(?:[-*•·]|\d+[.、)])\s*/u;
const RECOMMENDATION_PREFIX = /^\s*(?:建议|下一步)[:：]\s*/u;
/** Arrays the model does not need; they stay in the full output for evidence. */
const MODEL_OMITTED_KEYS = new Set(["workout_ids", "set_ids"]);

function collectStrings(value: unknown, key: string, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, key, into);
    }
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && Array.isArray(entryValue)) {
      for (const item of entryValue) {
        if (typeof item === "string") {
          into.add(item);
        }
      }
    } else {
      collectStrings(entryValue, key, into);
    }
  }
}

/**
 * Serializes a tool result for the model, dropping id lists that cost tokens
 * and carry no meaning for an explanation. Counts stay.
 *
 * @param output - The full tool result.
 * @returns JSON text for the tool message.
 */
export function compactToolOutputForModel(output: unknown): string {
  return JSON.stringify(output, (key, value: unknown) => {
    if (MODEL_OMITTED_KEYS.has(key) && Array.isArray(value)) {
      return { count: value.length };
    }

    return value;
  });
}

function sourcesFrom(runs: CoachToolRun[]): AssistantAnswerSource[] {
  const sources = new Map<string, AssistantAnswerSource>();

  for (const run of runs) {
    if (!run.ok || run.name !== "search_training_knowledge") {
      continue;
    }

    const list =
      (run.output as { sources?: AssistantAnswerSource[] } | null)?.sources ??
      [];

    for (const source of list) {
      sources.set(source.id, source);
    }
  }

  return [...sources.values()];
}

/**
 * Picks the closest existing intent label for display and analytics.
 *
 * @param runs - Tool calls of the turn.
 * @returns The intent label.
 */
export function coachIntentFor(runs: CoachToolRun[]): AssistantRoutedIntent {
  const names = new Set(runs.filter((run) => run.ok).map((run) => run.name));
  const usedKnowledge = names.has("search_training_knowledge");
  const usedData = [...names].some(
    (name) => name !== "search_training_knowledge" && name !== "find_exercises",
  );

  if (usedKnowledge && usedData) {
    return "mixed_tool_rag";
  }

  if (usedKnowledge) {
    return "knowledge";
  }

  if (names.has("get_exercise_progress")) {
    return "progress";
  }

  if (names.has("get_muscle_load")) {
    return "imbalance";
  }

  if (names.has("get_weekly_training_report")) {
    return "weekly_report";
  }

  if (names.has("get_recommendation_context")) {
    return "recommendation";
  }

  return usedData ? "summary" : "unsupported";
}

/**
 * Turns the model's reply into the structured answer the client renders.
 *
 * The first line becomes the summary, bullet lines become bullets, and a line
 * starting with 建议/下一步 becomes the recommendation. Evidence and sources
 * come from the tool results, never from the model's text.
 *
 * @param text - The model's final reply.
 * @param runs - Tool calls of the turn.
 * @returns The structured answer.
 */
export function buildCoachAnswer(
  text: string,
  runs: CoachToolRun[],
): AssistantStructuredAnswer {
  const lines = text
    .split("\n")
    .map((line) =>
      line
        .replace(/^#+\s*/u, "")
        .replace(/\*\*/gu, "")
        .trim(),
    )
    .filter((line) => line !== "");
  const summary = lines[0] ?? "";
  const bullets: string[] = [];
  let recommendation = "";

  for (const line of lines.slice(1)) {
    if (RECOMMENDATION_PREFIX.test(line)) {
      recommendation = line.replace(RECOMMENDATION_PREFIX, "");
    } else {
      bullets.push(line.replace(BULLET_PREFIX, ""));
    }
  }

  const okRuns = runs.filter((run) => run.ok);
  const outputs = okRuns.map((run) => run.output);
  const workoutIds = new Set<string>();
  const setIds = new Set<string>();
  const rules = new Set<string>();

  collectStrings(outputs, "workout_ids", workoutIds);
  collectStrings(outputs, "set_ids", setIds);
  collectStrings(outputs, "calculation_rules", rules);

  return {
    summary,
    bullets,
    conclusion: "",
    recommendation,
    evidence: {
      source: "deterministic_tool_executor",
      tool_names: [...new Set(okRuns.map((run) => run.name))],
      workout_ids: [...workoutIds],
      set_ids: [...setIds],
      calculation_rules: [...rules],
    },
    sources: sourcesFrom(runs),
    intent: coachIntentFor(runs),
    limitations: [],
  };
}

/**
 * Renders a stored answer as plain text for the conversation history.
 *
 * @param answer - A structured answer from an earlier turn.
 * @returns Text the model can read as its own earlier reply.
 */
export function answerToHistoryText(answer: AssistantStructuredAnswer): string {
  return [
    answer.summary,
    ...answer.bullets.map((bullet) => `- ${bullet}`),
    answer.recommendation === "" ? "" : `建议：${answer.recommendation}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
