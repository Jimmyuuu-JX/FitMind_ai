import type { AnalysisDateRange } from "./analysis-range";
import type { MuscleLoadGroup } from "./muscle-load-api";

import {
  BODY_PARTS,
  getBodyPartForMuscleName,
  type BodyPart,
} from "./body-part";

export type BodyPartValues = Record<BodyPart, number>;

export interface WeeklyTrendPoint {
  isCurrentWeek: boolean;
  /** Axis label: 本周 for the running week, MM/DD of the week start otherwise. */
  label: string;
  range: AnalysisDateRange;
  setCount: number;
  totalVolume: number;
  workoutCount: number;
  /** Weighted volume per body part, from the muscle-load contribution weights. */
  partVolumes: BodyPartValues;
}

export interface BodyPartShare {
  part: BodyPart;
  weightedVolume: number;
  /** Share of all mapped weighted volume, 0-1. */
  ratio: number;
  /** The fine-grained groups that make up this part, largest first. */
  groups: MuscleLoadGroup[];
}

export function emptyBodyPartValues(): BodyPartValues {
  return Object.fromEntries(BODY_PARTS.map((part) => [part, 0])) as Record<
    BodyPart,
    number
  >;
}

/**
 * Sums muscle-load groups into body parts.
 *
 * Weighted volume is additive across groups (each set is split by the
 * exercise's contribution weights), so summing it per part neither double
 * counts a set that hits two back muscles nor drops secondary work. Set counts
 * are not additive that way, which is why the part charts use volume.
 *
 * @param groups - Muscle-load groups for one range
 * @returns Weighted volume per part; unmapped groups are ignored
 */
export function sumPartVolumes(groups: MuscleLoadGroup[]): BodyPartValues {
  const values = emptyBodyPartValues();

  for (const group of groups) {
    const part = getBodyPartForMuscleName(group.muscle_group_name);

    if (part) {
      values[part] += group.weighted_volume;
    }
  }

  return values;
}

/**
 * Groups one range's muscle load into body-part shares, largest first.
 *
 * @param groups - Muscle-load groups for one range
 * @returns Parts with any volume, each carrying its child groups
 */
export function buildBodyPartShares(
  groups: MuscleLoadGroup[],
): BodyPartShare[] {
  const byPart = new Map<BodyPart, MuscleLoadGroup[]>();

  for (const group of groups) {
    const part = getBodyPartForMuscleName(group.muscle_group_name);

    if (part) {
      byPart.set(part, [...(byPart.get(part) ?? []), group]);
    }
  }

  const shares = [...byPart].map(([part, partGroups]) => ({
    groups: [...partGroups].sort(
      (left, right) => right.weighted_volume - left.weighted_volume,
    ),
    part,
    ratio: 0,
    weightedVolume: partGroups.reduce(
      (total, group) => total + group.weighted_volume,
      0,
    ),
  }));
  const total = shares.reduce((sum, share) => sum + share.weightedVolume, 0);

  return shares
    .filter((share) => share.weightedVolume > 0)
    .map((share) => ({
      ...share,
      ratio: total > 0 ? share.weightedVolume / total : 0,
    }))
    .sort((left, right) => right.weightedVolume - left.weightedVolume);
}

export interface WeekOverWeek {
  current: number;
  previous: number;
  /** Relative change, or null when the previous week was zero. */
  ratio: number | null;
}

/**
 * Compares the two most recent *completed* weeks.
 *
 * The running week is partial until Saturday, so comparing it with a full
 * week reports a drop every Monday. Skipping it keeps the number honest.
 *
 * @param points - Weekly points, oldest first, last one may be the running week
 * @param pick - Metric to compare
 * @returns Comparison, or null when fewer than two completed weeks exist
 */
export function compareCompletedWeeks(
  points: WeeklyTrendPoint[],
  pick: (point: WeeklyTrendPoint) => number,
): WeekOverWeek | null {
  const completed = points.filter((point) => !point.isCurrentWeek);
  const last = completed[completed.length - 1];
  const beforeLast = completed[completed.length - 2];

  if (!last || !beforeLast) {
    return null;
  }

  const current = pick(last);
  const previous = pick(beforeLast);

  return {
    current,
    previous,
    ratio: previous > 0 ? (current - previous) / previous : null,
  };
}

/**
 * Mean of a metric over completed weeks only (see {@link compareCompletedWeeks}).
 *
 * @param points - Weekly points, oldest first
 * @param pick - Metric to average
 * @returns Mean, or 0 when there is no completed week
 */
export function averageCompletedWeeks(
  points: WeeklyTrendPoint[],
  pick: (point: WeeklyTrendPoint) => number,
): number {
  const completed = points.filter((point) => !point.isCurrentWeek);

  if (completed.length === 0) {
    return 0;
  }

  return (
    completed.reduce((total, point) => total + pick(point), 0) /
    completed.length
  );
}

/** Signed percent for a week-over-week ratio, e.g. "+12%" / "-8%" / "持平". */
export function formatChangeRatio(ratio: number | null): string {
  if (ratio === null) {
    return "—";
  }

  const percent = Math.round(ratio * 100);

  if (percent === 0) {
    return "持平";
  }

  return `${percent > 0 ? "+" : ""}${percent}%`;
}

/** Kilograms as a compact axis/headline value: 950 → "950", 16945 → "16.9k". */
export function formatCompactKg(kilograms: number): string {
  if (kilograms >= 1000) {
    const thousands = kilograms / 1000;
    return `${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1)}k`;
  }

  return `${Math.round(kilograms)}`;
}
