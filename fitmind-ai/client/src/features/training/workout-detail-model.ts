import type {
  WorkoutDetailDto,
  WorkoutSetDto,
} from "../../../../shared/src/training";

export interface WorkoutExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSetDto[];
  /** Weight × reps over the group's working and warm-up sets. */
  totalVolume: number;
}

/**
 * Groups a workout's sets by exercise, in the order each exercise first
 * appears, with sets sorted by their per-exercise index.
 *
 * @param sets - Flat set list from the workout detail
 * @param exerciseNames - Display names by exercise id
 * @returns One group per exercise
 */
export function groupWorkoutSets(
  sets: WorkoutSetDto[],
  exerciseNames: Map<string, string>,
): WorkoutExerciseGroup[] {
  const grouped = new Map<string, WorkoutSetDto[]>();

  for (const set of sets) {
    grouped.set(set.exercise_id, [
      ...(grouped.get(set.exercise_id) ?? []),
      set,
    ]);
  }

  return [...grouped].map(([exerciseId, groupSets]) => ({
    exerciseId,
    exerciseName: exerciseNames.get(exerciseId) ?? "未知动作",
    sets: [...groupSets].sort(
      (left, right) => left.set_index - right.set_index,
    ),
    totalVolume: groupSets.reduce(
      (sum, set) => sum + set.weight_kg * set.reps,
      0,
    ),
  }));
}

/**
 * Session length for the detail header: the recorded start/end span when both
 * exist, otherwise the stored duration.
 *
 * @param workout - Workout detail
 * @returns Minutes, or null when neither is recorded
 */
export function getWorkoutMinutes(workout: WorkoutDetailDto): number | null {
  if (workout.started_at && workout.ended_at) {
    const minutes = Math.round(
      (new Date(workout.ended_at).getTime() -
        new Date(workout.started_at).getTime()) /
        60000,
    );

    if (Number.isFinite(minutes) && minutes >= 0) {
      return minutes;
    }
  }

  return workout.duration_minutes;
}

/** 71 → "1小时11分钟", 45 → "45分钟", 120 → "2小时". */
export function formatDurationZh(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest}分钟`;
  }

  return rest === 0 ? `${hours}小时` : `${hours}小时${rest}分钟`;
}

/** Local HH:MM. */
export function formatClock(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

/** Kilograms without trailing zeros: 87.5 → "87.5", 90 → "90". */
export function formatKg(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`;
}
