import {
  TURN_EVAL_REQUIRED_CATEGORIES,
  type TurnEvalCase,
  type TurnEvalCategory,
  type TurnEvalOutcome,
} from "./turn-eval-cases.js";

/** One tool call as recorded for a turn. */
export interface TurnEvalToolCall {
  name: string;
  input: unknown;
  output: unknown;
  status: string;
}

/** What one turn produced, read from the stream and the tool-call log. */
export interface TurnEvalObservation {
  userMessage: string;
  toolCalls: TurnEvalToolCall[];
  answerText: string;
  hasClarification: boolean;
  hasPlan: boolean;
  sourceCount: number;
  /** Stream `error` event or transport failure, if any. */
  error: string | null;
  /**
   * Claims the server's own number check could not verify against the full
   * tool results of the turn; `null` when the server reported no check.
   */
  serverUnverifiedClaims: string[] | null;
}

export interface TurnEvalCaseResult {
  id: string;
  category: TurnEvalCategory;
  passed: boolean;
  outcome: TurnEvalOutcome | "error";
  failures: string[];
  /** Claims the server's number check flagged; any entry fails the case and the gate. */
  flaggedClaims: string[];
  /**
   * Numbers the eval could not find in the logged tool outputs or user
   * messages. Logged outputs are summaries, so these are leads for review,
   * not failures.
   */
  unverifiableNumbers: string[];
}

export interface TurnEvalCategoryScore {
  category: TurnEvalCategory;
  passed: number;
  total: number;
}

export interface TurnEvalReport {
  passed: number;
  total: number;
  categories: TurnEvalCategoryScore[];
  /** Cases whose answer the server's number check flagged. */
  unfaithfulCases: string[];
  /** Cases with numbers the eval could not trace in the logs (review only). */
  reviewCases: string[];
  /** Required categories with a failing case. */
  failedRequiredCategories: TurnEvalCategory[];
  /** True when every required category passes and no answer is unfaithful. */
  gatePassed: boolean;
  results: TurnEvalCaseResult[];
}

/** Phrases that send the user to medical help; a refusal may mention "医疗" too. */
const SAFETY_PHRASES = /医生|就医|急救/;
/** Plain numbers and numbers with thousands separators such as 41,080. */
const NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
/** Small integers are list markers, ordinals and counts too often to judge. */
const SMALL_INTEGER_LIMIT = 10;

/**
 * Decides what kind of reply a turn ended in.
 *
 * @param observation - The graded turn.
 * @returns The reply kind, or `error` when the turn failed.
 */
export function classifyTurnOutcome(
  observation: TurnEvalObservation,
): TurnEvalOutcome | "error" {
  if (observation.error !== null) {
    return "error";
  }

  if (observation.hasClarification) {
    return "clarification";
  }

  if (observation.hasPlan) {
    return "plan";
  }

  if (observation.toolCalls.length > 0 || observation.sourceCount > 0) {
    return "answer";
  }

  return SAFETY_PHRASES.test(observation.answerText) ? "safety" : "refusal";
}

function normalizeNumber(raw: string): string {
  return String(Number(raw.replaceAll(",", "")));
}

function collectNumbers(text: string): Set<string> {
  return new Set(
    (text.match(NUMBER_PATTERN) ?? []).map((raw) =>
      normalizeNumber(raw.replaceAll(",", "")),
    ),
  );
}

function supportedNumbers(observations: TurnEvalObservation[]): Set<string> {
  const supported = new Set<string>();

  for (const observation of observations) {
    for (const value of collectNumbers(observation.userMessage)) {
      supported.add(value);
    }

    for (const call of observation.toolCalls) {
      for (const value of collectNumbers(
        JSON.stringify([call.input, call.output]),
      )) {
        const parsed = Number(value);

        supported.add(value);
        // Accept the usual presentations of a tool value: rounded to an
        // integer or one decimal, and a 0..1 ratio shown as a percentage.
        supported.add(String(Math.round(parsed)));
        supported.add(String(Math.round(parsed * 10) / 10));

        if (parsed > 0 && parsed <= 1) {
          supported.add(String(Math.round(parsed * 100)));
          supported.add(String(Math.round(parsed * 1000) / 10));
        }
      }
    }
  }

  return supported;
}

/**
 * Lists numbers in the graded answer that nothing in the session supports.
 *
 * @param observations - Every turn of the case, graded turn last.
 * @returns Unsupported numbers, normalized.
 */
export function findUnsupportedNumbers(
  observations: TurnEvalObservation[],
): string[] {
  const graded = observations[observations.length - 1];

  if (graded === undefined) {
    return [];
  }

  const supported = supportedNumbers(observations);

  return [...collectNumbers(graded.answerText)].filter((value) => {
    const parsed = Number(value);

    if (Number.isInteger(parsed) && parsed <= SMALL_INTEGER_LIMIT) {
      return false;
    }

    return !supported.has(value);
  });
}

function mentionsNumber(text: string, value: number): boolean {
  return collectNumbers(text).has(normalizeNumber(String(value)));
}

function exerciseIdsUsed(observation: TurnEvalObservation): Set<string> {
  const ids = new Set<string>();

  for (const call of observation.toolCalls) {
    const input = call.input;

    if (input !== null && typeof input === "object" && "exercise_id" in input) {
      const value = (input as { exercise_id?: unknown }).exercise_id;

      if (typeof value === "string") {
        ids.add(value);
      }
    }
  }

  return ids;
}

/**
 * Grades one case against what its turns produced.
 *
 * @param testCase - The case definition.
 * @param observations - One observation per turn, in order.
 * @param exerciseIdsByCode - Dictionary ids for the exercise codes cases name.
 * @returns The case result with every failed expectation listed.
 */
export function gradeTurnEvalCase(
  testCase: TurnEvalCase,
  observations: TurnEvalObservation[],
  exerciseIdsByCode: ReadonlyMap<string, string>,
): TurnEvalCaseResult {
  const failures: string[] = [];
  const graded = observations[observations.length - 1];

  if (graded === undefined || observations.length !== testCase.turns.length) {
    return {
      id: testCase.id,
      category: testCase.category,
      passed: false,
      outcome: "error",
      failures: ["not every turn produced an observation"],
      flaggedClaims: [],
      unverifiableNumbers: [],
    };
  }

  const expect = testCase.expect;
  const outcome = classifyTurnOutcome(graded);
  const calledTools = graded.toolCalls.map((call) => call.name);

  if (graded.error !== null) {
    failures.push(`turn failed: ${graded.error}`);
  }

  if (outcome !== expect.outcome) {
    failures.push(`outcome ${outcome}, expected ${expect.outcome}`);
  }

  for (const tool of expect.toolsAll ?? []) {
    if (!calledTools.includes(tool)) {
      failures.push(`did not call ${tool}`);
    }
  }

  if (
    expect.toolsAny !== undefined &&
    !expect.toolsAny.some((tool) => calledTools.includes(tool))
  ) {
    failures.push(`called none of ${expect.toolsAny.join(", ")}`);
  }

  if (expect.toolCallsAtLeast !== undefined) {
    const { tool, count } = expect.toolCallsAtLeast;
    const actual = calledTools.filter((name) => name === tool).length;

    if (actual < count) {
      failures.push(
        `called ${tool} ${actual} time(s), expected at least ${count}`,
      );
    }
  }

  const usedIds = exerciseIdsUsed(graded);

  for (const code of expect.exerciseArgs ?? []) {
    const id = exerciseIdsByCode.get(code);

    if (id === undefined) {
      failures.push(`exercise ${code} is not in the dictionary`);
    } else if (!usedIds.has(id)) {
      failures.push(`no tool call used exercise ${code}`);
    }
  }

  for (const value of expect.mentionsNumbers ?? []) {
    if (!mentionsNumber(graded.answerText, value)) {
      failures.push(`answer does not state ${value}`);
    }
  }

  if (
    expect.mentionsAny !== undefined &&
    !expect.mentionsAny.some((phrase) => graded.answerText.includes(phrase))
  ) {
    failures.push(`answer mentions none of ${expect.mentionsAny.join(" / ")}`);
  }

  if (expect.hasSources === true && graded.sourceCount === 0) {
    failures.push("answer cites no knowledge source");
  }

  const flaggedClaims = graded.serverUnverifiedClaims ?? [];

  if (flaggedClaims.length > 0) {
    failures.push(
      `server flagged unverified claims: ${flaggedClaims.join(", ")}`,
    );
  }

  return {
    id: testCase.id,
    category: testCase.category,
    passed: failures.length === 0,
    outcome,
    failures,
    flaggedClaims,
    unverifiableNumbers: findUnsupportedNumbers(observations),
  };
}

/**
 * Summarizes case results into category scores and the run gate.
 *
 * @param results - Graded cases.
 * @returns The report.
 */
export function summarizeTurnEval(
  results: TurnEvalCaseResult[],
): TurnEvalReport {
  const byCategory = new Map<TurnEvalCategory, TurnEvalCategoryScore>();

  for (const result of results) {
    const score = byCategory.get(result.category) ?? {
      category: result.category,
      passed: 0,
      total: 0,
    };

    score.total += 1;
    score.passed += result.passed ? 1 : 0;
    byCategory.set(result.category, score);
  }

  const failedRequiredCategories = [...TURN_EVAL_REQUIRED_CATEGORIES].filter(
    (category) =>
      results.some((result) => result.category === category && !result.passed),
  );
  const unfaithfulCases = results
    .filter((result) => result.flaggedClaims.length > 0)
    .map((result) => result.id);
  const reviewCases = results
    .filter((result) => result.unverifiableNumbers.length > 0)
    .map((result) => result.id);

  return {
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    categories: [...byCategory.values()],
    unfaithfulCases,
    reviewCases,
    failedRequiredCategories,
    gatePassed:
      failedRequiredCategories.length === 0 && unfaithfulCases.length === 0,
    results,
  };
}
