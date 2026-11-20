/**
 * Deterministic training history for the whole-turn assistant eval.
 *
 * Eight weeks, three sessions a week, dated backwards from an anchor day so
 * that "recent" questions always have recent data. The history is shaped to
 * contain a few situations a coach should notice:
 *
 * - barbell bench press climbs for four weeks, then stays at the same top
 *   weight for the last five (a plateau);
 * - barbell row climbs every week (steady progress);
 * - legs are trained only in the first two weeks (an imbalance);
 * - the most recent session was two days before the anchor.
 *
 * The facts the graders check are derived from the same definitions, so a
 * change to the history changes the expectations with it.
 */

export const TURN_EVAL_TIME_ZONE = "Asia/Shanghai";
export const TURN_EVAL_WEEKS = 8;

export interface TurnEvalSetDefinition {
  exerciseCode: string;
  sets: number;
  reps: number;
  weightKg: number;
  rpe: number;
}

export interface TurnEvalWorkoutDefinition {
  /** Whole days before the anchor day, in the eval time zone. */
  daysAgo: number;
  notes: string;
  exercises: TurnEvalSetDefinition[];
}

/** Top working weight of barbell bench press, by week (oldest first). */
const BENCH_TOP_KG = [70, 72.5, 75, 77.5, 77.5, 77.5, 77.5, 77.5];
/** Working weight of barbell row, by week (oldest first). */
const ROW_KG = [60, 62.5, 65, 67.5, 70, 72.5, 75, 77.5];
/** Weeks (oldest first, zero-based) that still include squats. */
const SQUAT_WEEKS = new Set([0, 1]);
const SQUAT_KG = 100;

/** Session offsets within a week: push, pull, upper. */
const PUSH_DAY = 1;
const PULL_DAY = 3;
const UPPER_DAY = 5;

function daysAgoFor(week: number, dayInWeek: number): number {
  return TURN_EVAL_WEEKS * 7 - (week * 7 + dayInWeek);
}

/**
 * Builds the eval training history.
 *
 * @returns Workouts ordered oldest first.
 */
export function buildTurnEvalWorkouts(): TurnEvalWorkoutDefinition[] {
  const workouts: TurnEvalWorkoutDefinition[] = [];

  for (let week = 0; week < TURN_EVAL_WEEKS; week += 1) {
    const benchTop = BENCH_TOP_KG[week]!;
    const benchRpe = week >= 4 ? 9 : 8;

    workouts.push({
      daysAgo: daysAgoFor(week, PUSH_DAY),
      notes: "推",
      exercises: [
        {
          exerciseCode: "bench_press_barbell",
          sets: 4,
          reps: 5,
          weightKg: benchTop,
          rpe: benchRpe,
        },
        {
          exerciseCode: "incline_bench_press_dumbbell",
          sets: 3,
          reps: 10,
          weightKg: 26,
          rpe: 8,
        },
        {
          exerciseCode: "triceps_pushdown_cable",
          sets: 3,
          reps: 12,
          weightKg: 25,
          rpe: 8,
        },
      ],
    });

    workouts.push({
      daysAgo: daysAgoFor(week, PULL_DAY),
      notes: "拉",
      exercises: [
        {
          exerciseCode: "barbell_row",
          sets: 4,
          reps: 8,
          weightKg: ROW_KG[week]!,
          rpe: 8,
        },
        {
          exerciseCode: "lat_pulldown_cable",
          sets: 3,
          reps: 10,
          weightKg: 55,
          rpe: 8,
        },
        {
          exerciseCode: "dumbbell_curl",
          sets: 3,
          reps: 12,
          weightKg: 12.5,
          rpe: 8,
        },
      ],
    });

    const upper: TurnEvalSetDefinition[] = [
      {
        exerciseCode: "shoulder_press_dumbbell",
        sets: 3,
        reps: 10,
        weightKg: 20,
        rpe: 8,
      },
      {
        exerciseCode: "bench_press_barbell",
        sets: 3,
        reps: 8,
        weightKg: benchTop - 10,
        rpe: 7,
      },
      {
        exerciseCode: "lateral_raise_dumbbell",
        sets: 3,
        reps: 15,
        weightKg: 8,
        rpe: 8,
      },
    ];

    if (SQUAT_WEEKS.has(week)) {
      upper.unshift({
        exerciseCode: "barbell_back_squat",
        sets: 3,
        reps: 5,
        weightKg: SQUAT_KG,
        rpe: 8,
      });
    }

    workouts.push({
      daysAgo: daysAgoFor(week, UPPER_DAY),
      notes: SQUAT_WEEKS.has(week) ? "上肢+深蹲" : "上肢",
      exercises: upper,
    });
  }

  return workouts.sort((a, b) => b.daysAgo - a.daysAgo);
}

/** Facts a correct answer may need to state, derived from the history above. */
export interface TurnEvalFacts {
  benchTopKg: number;
  benchPlateauWeeks: number;
  rowStartKg: number;
  rowTopKg: number;
  workoutsLast7Days: number;
  daysSinceLastLegSession: number;
}

/**
 * Derives grader facts from the history.
 *
 * @param workouts - The history returned by {@link buildTurnEvalWorkouts}.
 * @returns Facts with the values the history actually contains.
 */
export function deriveTurnEvalFacts(
  workouts: TurnEvalWorkoutDefinition[] = buildTurnEvalWorkouts(),
): TurnEvalFacts {
  const benchTopKg = Math.max(...BENCH_TOP_KG);
  let benchPlateauWeeks = 0;

  for (
    let week = TURN_EVAL_WEEKS - 1;
    week >= 0 && BENCH_TOP_KG[week] === benchTopKg;
    week -= 1
  ) {
    benchPlateauWeeks += 1;
  }

  const legSessions = workouts.filter((workout) =>
    workout.exercises.some(
      (exercise) => exercise.exerciseCode === "barbell_back_squat",
    ),
  );

  return {
    benchTopKg,
    benchPlateauWeeks,
    rowStartKg: ROW_KG[0]!,
    rowTopKg: Math.max(...ROW_KG),
    // Days 0..6 before the anchor, the window a "last 7 days" question covers.
    workoutsLast7Days: workouts.filter((workout) => workout.daysAgo <= 6)
      .length,
    daysSinceLastLegSession: Math.min(
      ...legSessions.map((workout) => workout.daysAgo),
    ),
  };
}
