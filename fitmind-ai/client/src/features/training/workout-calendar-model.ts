import type {
  WorkoutDetailDto,
  WorkoutSummaryDto,
} from "../../../../shared/src/training";

import { getWorkoutBodyPart, type BodyPart } from "./body-part";

export interface WorkoutCalendarDaySummary {
  notes: string[];
  /** Dominant body part per workout, parallel to {@link notes}. */
  parts: Array<BodyPart | null>;
  totalVolume: number | null;
  workoutCount: number;
}

/**
 * Groups loaded workout summaries into local calendar days.
 *
 * Each workout contributes one note line. Missing notes remain visible as a
 * muted product-level placeholder instead of silently disappearing.
 */
export function summarizeWorkoutCalendarDays(
  workouts: WorkoutSummaryDto[],
): Map<string, WorkoutCalendarDaySummary> {
  const grouped = new Map<
    string,
    {
      notes: string[];
      parts: Array<BodyPart | null>;
      totalVolume: number;
      volumeIsKnown: boolean;
      workoutCount: number;
    }
  >();

  for (const workout of workouts) {
    const key = toWorkoutLocalDateKey(new Date(workout.performed_at));
    const current = grouped.get(key) ?? {
      notes: [],
      parts: [],
      totalVolume: 0,
      volumeIsKnown: true,
      workoutCount: 0,
    };
    const volume = workout.total_volume;

    current.notes.push(workout.notes?.trim() || "未填写备注");
    current.parts.push(getWorkoutBodyPart(workout));
    current.workoutCount += 1;
    if (typeof volume === "number" && Number.isFinite(volume)) {
      current.totalVolume += volume;
    } else {
      current.volumeIsKnown = false;
    }
    grouped.set(key, current);
  }

  return new Map(
    [...grouped].map(([key, day]) => [
      key,
      {
        notes: day.notes,
        parts: day.parts,
        totalVolume: day.volumeIsKnown ? day.totalVolume : null,
        workoutCount: day.workoutCount,
      },
    ]),
  );
}

export interface WorkoutMonthSummary {
  /** Distinct local days with at least one workout. */
  trainingDays: number;
  /** Null while any workout in the month lacks a volume. */
  totalVolume: number | null;
  /** Summed recorded durations; sessions without one are skipped. */
  totalMinutes: number;
}

/**
 * Totals for one calendar month, from the workouts loaded so far.
 *
 * @param workouts - Loaded workout summaries (any months)
 * @param year - Full year
 * @param monthIndex - Zero-based month
 * @returns Training days, volume and duration for that month
 */
export function summarizeWorkoutMonth(
  workouts: WorkoutSummaryDto[],
  year: number,
  monthIndex: number,
): WorkoutMonthSummary {
  const days = new Set<string>();
  let totalVolume: number | null = 0;
  let totalMinutes = 0;

  for (const workout of workouts) {
    const performedAt = new Date(workout.performed_at);

    if (
      performedAt.getFullYear() !== year ||
      performedAt.getMonth() !== monthIndex
    ) {
      continue;
    }

    days.add(toWorkoutLocalDateKey(performedAt));
    totalMinutes += workout.duration_minutes ?? 0;

    const volume = workout.total_volume;
    totalVolume =
      totalVolume !== null &&
      typeof volume === "number" &&
      Number.isFinite(volume)
        ? totalVolume + volume
        : null;
  }

  return { totalMinutes, totalVolume, trainingDays: days.size };
}

export function formatCalendarVolume(totalVolume: number | null): string {
  return totalVolume === null ? "—" : Math.round(totalVolume).toLocaleString();
}

export function formatAccessibleCalendarVolume(
  totalVolume: number | null,
): string {
  return totalVolume === null
    ? "暂未提供"
    : `${Math.round(totalVolume).toLocaleString()} 公斤`;
}

export function calculateWorkoutVolume(workout: WorkoutDetailDto): number {
  return workout.sets.reduce(
    (total, set) => total + set.weight_kg * set.reps,
    0,
  );
}

export function toWorkoutLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
