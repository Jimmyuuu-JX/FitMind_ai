/**
 * Whole-turn assistant eval.
 *
 * Runs every case in `turn-eval-cases.ts` through the real HTTP stream
 * endpoint of an in-process app, against a disposable local database seeded
 * with the eval training history, and grades what each turn did. The provider
 * is whatever `ASSISTANT_PROVIDER` selects, so the same cases score the
 * deterministic path and a real model.
 *
 * usage:
 *   pnpm --filter @fitmind/server eval:turns -- [--env-file <path>] [--out <report.json>]
 *
 * The database must be on this machine: the run deletes and recreates the eval
 * user and its data. Exit code 1 means the gate failed (a safety case failed or
 * an answer stated an unsupported number); other misses are reported only.
 */

import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

import type { DbPool } from "../src/db/pool.js";
import { CURRENT_PRIVACY_POLICY_VERSION } from "../src/services/auth/consent-service.js";
import { buildTurnEvalCases } from "../src/services/assistant/turn-eval/turn-eval-cases.js";
import {
  buildTurnEvalWorkouts,
  TURN_EVAL_TIME_ZONE,
} from "../src/services/assistant/turn-eval/turn-eval-fixture.js";
import {
  gradeTurnEvalCase,
  summarizeTurnEval,
  type TurnEvalObservation,
  type TurnEvalReport,
} from "../src/services/assistant/turn-eval/turn-eval-grader.js";

const EVAL_EMAIL = "turn-eval@fitmind.local";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const TURN_TIMEOUT_MS = 120_000;

interface CliOptions {
  envFile?: string | undefined;
  out?: string | undefined;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--env-file") {
      options.envFile = argv[(index += 1)];
    } else if (arg === "--out") {
      options.out = argv[(index += 1)];
    } else if (arg !== "--") {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireLocalDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;

  if (raw === undefined || raw.trim() === "") {
    throw new Error("DATABASE_URL is required (a local, disposable database).");
  }

  const host = new URL(raw).hostname;

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run: DATABASE_URL points at ${host}. The eval deletes and recreates data, so it only runs against a database on this machine.`,
    );
  }

  return raw;
}

/** Calendar date of `daysAgo` days before today in the eval time zone, at 18:00 local. */
function performedAt(daysAgo: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TURN_EVAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = today.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day - daysAgo, 10, 0, 0));

  return date.toISOString();
}

class Client {
  private cookie = "";

  public constructor(private readonly baseUrl: string) {}

  public async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.cookie === "" ? {} : { cookie: this.cookie }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");

    if (setCookie !== null) {
      this.cookie = setCookie.split(";")[0] ?? "";
    }

    return response;
  }

  public async json<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.request(method, path, body);
    const payload = (await response.json()) as {
      ok: boolean;
      data?: T;
      error?: unknown;
    };

    if (!response.ok || !payload.ok) {
      throw new Error(
        `${method} ${path} failed (${response.status}): ${JSON.stringify(payload.error)}`,
      );
    }

    return payload.data as T;
  }
}

async function resetEvalUser(pool: DbPool, client: Client): Promise<string> {
  await pool.query("DELETE FROM users WHERE email = $1", [EVAL_EMAIL]);
  await client.json("POST", "/api/auth/register", {
    email: EVAL_EMAIL,
    password: randomBytes(18).toString("base64url"),
    display_name: "Turn Eval",
    cross_border_consent: {
      accepted: true,
      policy_version: CURRENT_PRIVACY_POLICY_VERSION,
    },
  });
  const me = await client.json<{ user: { id: string } }>("GET", "/api/auth/me");

  return me.user.id;
}

async function seedHistory(
  client: Client,
  exerciseIds: ReadonlyMap<string, string>,
): Promise<number> {
  const workouts = buildTurnEvalWorkouts();

  for (const workout of workouts) {
    const sets = workout.exercises.flatMap((exercise) => {
      const exerciseId = exerciseIds.get(exercise.exerciseCode);

      if (exerciseId === undefined) {
        throw new Error(
          `Exercise ${exercise.exerciseCode} is missing; run the dictionary seed first.`,
        );
      }

      return Array.from({ length: exercise.sets }, (_, index) => ({
        exercise_id: exerciseId,
        set_index: index + 1,
        reps: exercise.reps,
        weight_kg: exercise.weightKg,
        rpe: exercise.rpe,
        is_warmup: false,
      }));
    });

    await client.json("POST", "/api/workouts", {
      performed_at: performedAt(workout.daysAgo),
      duration_minutes: 60,
      notes: workout.notes,
      sets,
    });
  }

  return workouts.length;
}

interface StreamResult {
  sessionId: string | null;
  provider: string | null;
  output: Record<string, unknown> | null;
  deltas: string;
  error: string | null;
}

async function streamTurn(
  client: Client,
  message: string,
  sessionId: string | null,
): Promise<StreamResult> {
  const result: StreamResult = {
    sessionId,
    provider: null,
    output: null,
    deltas: "",
    error: null,
  };
  const response = await client.request("POST", "/api/assistant/stream-turn", {
    mode: "auto",
    message,
    timezone: TURN_EVAL_TIME_ZONE,
    ...(sessionId === null ? {} : { session_id: sessionId }),
  });

  if (!response.ok || response.body === null) {
    result.error = `HTTP ${response.status}: ${await response.text()}`;
    return result;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk as Uint8Array, { stream: true });
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("\n");

      if (data === "") {
        continue;
      }

      const event = JSON.parse(data) as Record<string, unknown> & {
        type: string;
      };

      if (event.type === "session" && typeof event.session_id === "string") {
        result.sessionId = event.session_id;
      } else if (
        event.type === "provider_selected" &&
        typeof event.provider === "string"
      ) {
        result.provider = event.provider;
      } else if (
        event.type === "answer_delta" &&
        typeof event.text === "string"
      ) {
        result.deltas += event.text;
      } else if (event.type === "structured_output") {
        result.output = event.output as Record<string, unknown>;
      } else if (event.type === "error") {
        result.error = `${String(event.code)}: ${String(event.message)}`;
      }
    }
  }

  return result;
}

function serverUnverifiedClaimsOf(result: StreamResult): string[] | null {
  const faithfulness = result.output?.faithfulness as
    | { unverifiedClaims?: unknown }
    | undefined;

  if (
    faithfulness === undefined ||
    !Array.isArray(faithfulness.unverifiedClaims)
  ) {
    return null;
  }

  return faithfulness.unverifiedClaims.map(String);
}

function answerTextOf(result: StreamResult): string {
  const answer = result.output?.answer as
    | {
        summary?: string;
        bullets?: string[];
        conclusion?: string;
        recommendation?: string;
      }
    | undefined;

  if (answer === undefined) {
    return result.deltas;
  }

  return [
    answer.summary,
    ...(answer.bullets ?? []),
    answer.conclusion,
    answer.recommendation,
  ]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join("\n");
}

async function toolCallsSince(pool: DbPool, userId: string, since: Date) {
  const rows = await pool.query<{
    tool_name: string;
    tool_input: unknown;
    tool_output: unknown;
    status: string;
  }>(
    `SELECT tool_name, tool_input, tool_output, status
       FROM tool_call_logs
      WHERE user_id = $1 AND created_at >= $2
      ORDER BY created_at, id`,
    [userId, since],
  );

  return rows.rows.map((row) => ({
    name: row.tool_name,
    input: row.tool_input,
    output: row.tool_output,
    status: row.status,
  }));
}

function printReport(report: TurnEvalReport, provider: string): void {
  console.log(`=== FitMind whole-turn eval (provider: ${provider}) ===`);

  for (const result of report.results) {
    console.log(
      `[${result.passed ? "PASS" : "FAIL"}] ${result.category}/${result.id} -> ${result.outcome}`,
    );

    for (const failure of result.failures) {
      console.log(`    - ${failure}`);
    }
  }

  console.log("--- by category");

  for (const score of report.categories) {
    console.log(`${score.category}: ${score.passed}/${score.total}`);
  }

  console.log(`--- total ${report.passed}/${report.total}`);
  const failingRequired = report.failedRequiredCategories.join(", ") || "none";
  const flagged = report.unfaithfulCases.join(", ") || "none";

  console.log(
    `gate: ${report.gatePassed ? "PASS" : "FAIL"} (required categories failing: ${failingRequired}; server-flagged claims in: ${flagged})`,
  );
  console.log(
    `review (numbers not found in the summarized tool logs): ${report.reviewCases.join(", ") || "none"}`,
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.envFile !== undefined) {
    process.loadEnvFile(options.envFile);
  }

  requireLocalDatabaseUrl();
  // The eval user is created through the public register endpoint.
  process.env.REGISTRATION_INVITE_ONLY = "off";
  // Sessions only need to survive this run.
  process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

  const [{ createApp }, { createAiRateLimiter }] = await Promise.all([
    import("../src/app.js"),
    import("../src/services/assistant/ai-rate-limiter.js"),
  ]);
  const unlimited = () =>
    createAiRateLimiter({ perMinute: 1_000_000, perDay: 1_000_000 });
  const app = createApp({
    authRateLimiter: unlimited(),
    assistantRateLimiter: unlimited(),
    assistantIpRateLimiter: unlimited(),
    requestCompletionLogger: () => undefined,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  const client = new Client(`http://127.0.0.1:${port}`);
  const { createDbPool, closeDbPool } = await import("../src/db/pool.js");
  const pool = createDbPool();

  try {
    const exerciseRows = await pool.query<{ code: string; id: string }>(
      "SELECT code, id FROM exercises",
    );
    const exerciseIds = new Map(
      exerciseRows.rows.map((row) => [row.code, row.id]),
    );
    const userId = await resetEvalUser(pool, client);
    const workoutCount = await seedHistory(client, exerciseIds);
    console.log(`Seeded ${workoutCount} workouts for ${EVAL_EMAIL}.`);

    const cases = buildTurnEvalCases();
    const results = [];
    const transcripts = [];
    let provider = process.env.ASSISTANT_PROVIDER ?? "mock";

    for (const testCase of cases) {
      const observations: TurnEvalObservation[] = [];
      let sessionId: string | null = null;

      for (const message of testCase.turns) {
        const startedAt = new Date();
        const timeout = new Promise<StreamResult>((resolve) =>
          setTimeout(
            () =>
              resolve({
                sessionId,
                provider: null,
                output: null,
                deltas: "",
                error: "timeout",
              }),
            TURN_TIMEOUT_MS,
          ).unref(),
        );
        const result: StreamResult = await Promise.race([
          streamTurn(client, message, sessionId),
          timeout,
        ]);
        sessionId = result.sessionId;
        provider = result.provider ?? provider;
        const sources = (
          result.output?.answer as { sources?: unknown[] } | undefined
        )?.sources;

        observations.push({
          userMessage: message,
          toolCalls: await toolCallsSince(pool, userId, startedAt),
          answerText: answerTextOf(result),
          hasClarification: result.output?.clarification != null,
          hasPlan: result.output?.plan != null,
          sourceCount: Array.isArray(sources) ? sources.length : 0,
          error: result.error,
          serverUnverifiedClaims: serverUnverifiedClaimsOf(result),
        });
      }

      results.push(gradeTurnEvalCase(testCase, observations, exerciseIds));
      transcripts.push({ id: testCase.id, observations });
    }

    const report = summarizeTurnEval(results);
    printReport(report, provider);

    if (options.out !== undefined) {
      writeFileSync(
        options.out,
        `${JSON.stringify({ provider, ranAt: new Date().toISOString(), report, transcripts }, null, 2)}\n`,
      );
      console.log(`Report written to ${options.out}`);
    }

    process.exitCode = report.gatePassed ? 0 : 1;
  } finally {
    await closeDbPool();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((error: unknown) => {
  console.error(
    `Turn eval failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
