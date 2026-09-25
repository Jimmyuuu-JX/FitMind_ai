import { useEffect, useMemo, useState } from "react";

import { createWeeklyBuckets, formatMonthDay } from "./analysis-range";
import { getMuscleLoad } from "./muscle-load-api";
import { getTrainingSummary } from "./training-summary-api";
import { sumPartVolumes, type WeeklyTrendPoint } from "./weekly-trend-model";

export interface UseWeeklyTrendResult {
  errorMessage: string | null;
  isLoading: boolean;
  points: WeeklyTrendPoint[] | null;
}

/**
 * Loads per-week totals for the trailing weeks, oldest first.
 *
 * The training endpoints have no weekly bucket, so each Sunday-to-Saturday
 * week asks the summary (sessions, sets, volume) and muscle-load (per-part
 * weighted volume) endpoints once. Every number is still the server's
 * deterministic calculation for that exact week, not a client estimate.
 *
 * @param token - Current in-memory auth token
 * @param weekCount - Number of weeks including the running one
 * @param refreshSignal - Increment to force a reload
 * @returns Weekly points plus loading and error state
 */
export function useWeeklyTrend(
  token: string | null,
  weekCount: number,
  refreshSignal = 0,
): UseWeeklyTrendResult {
  const buckets = useMemo(() => createWeeklyBuckets(weekCount), [weekCount]);
  const [points, setPoints] = useState<WeeklyTrendPoint[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function load(): Promise<void> {
      if (!token) {
        setPoints(null);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const weeks = await Promise.all(
          buckets.map((bucket) => {
            const query = {
              endDate: bucket.range.end_date,
              startDate: bucket.range.start_date,
            };

            return Promise.all([
              getTrainingSummary(token, query),
              getMuscleLoad(token, query),
            ]);
          }),
        );

        if (!isActive) {
          return;
        }

        setPoints(
          buckets.map((bucket, index) => {
            const [summary, muscleLoad] = weeks[index] ?? [];
            const isCurrentWeek = index === buckets.length - 1;

            return {
              isCurrentWeek,
              label: isCurrentWeek
                ? "本周"
                : formatMonthDay(bucket.range.start_date),
              partVolumes: sumPartVolumes(muscleLoad?.by_muscle_group ?? []),
              range: bucket.range,
              setCount: summary?.totals.set_count ?? 0,
              totalVolume: summary?.totals.total_volume ?? 0,
              workoutCount: summary?.totals.workout_count ?? 0,
            };
          }),
        );
      } catch {
        if (isActive) {
          setPoints(null);
          setErrorMessage("周趋势暂时不可用。");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [buckets, refreshSignal, token]);

  return { errorMessage, isLoading, points };
}
