import { useMemo, useState } from "react";

import { SegmentedControl } from "../../components/SegmentedControl";
import {
  ANALYSIS_RANGE_OPTIONS,
  createAnalysisRange,
  type AnalysisRangeKey,
} from "./analysis-range";
import { AnalysisOverviewCard } from "./AnalysisOverviewCard";
import { ExerciseProgressPanel } from "./ExerciseProgressPanel";
import {
  ExerciseProgressSheet,
  type ExerciseProgressSheetExercise,
} from "./ExerciseProgressSheet";
import { BodyPartTrendCard } from "./BodyPartTrendCard";
import { MuscleLoadPanel } from "./MuscleLoadPanel";
import { TrainingOverviewCard } from "./TrainingOverviewCard";
import { useMuscleLoad } from "./use-muscle-load";
import { useTrainingSummary } from "./use-training-summary";
import { useWeeklyTrend } from "./use-weekly-trend";
import { WeeklyVolumeCard } from "./WeeklyVolumeCard";
import { useTheme } from "../../theme/ThemeContext";

export interface AnalysisViewProps {
  /** Reports the focused exercise so the assistant can answer about it. */
  onExerciseSelect: (exerciseId: string, exerciseName: string) => void;
  refreshSignal: number;
  selectedExerciseId: string | null;
  token: string | null;
}

/** Trailing weeks loaded for the overview, volume and body-part trends. */
const TREND_WEEKS = 12;

/**
 * Analysis tab in three bands: 本周 (this week against the recent rhythm),
 * 区间 (one range control drives 总览 / 部位占比 / 动作进展), and 周趋势
 * (fixed trailing weeks of volume, overall and per body part).
 *
 * @param props - Auth token, refresh signal, and exercise selection wiring
 * @returns Analysis tab element
 */
export function AnalysisView(props: AnalysisViewProps) {
  const { refreshSignal, selectedExerciseId, token } = props;
  const [rangeKey, setRangeKey] = useState<AnalysisRangeKey>("last30");
  const [sheetExercise, setSheetExercise] =
    useState<ExerciseProgressSheetExercise | null>(null);
  const range = useMemo(() => createAnalysisRange(rangeKey), [rangeKey]);
  const summaryState = useTrainingSummary(token, range, refreshSignal);
  const muscleLoadState = useMuscleLoad(token, range, refreshSignal);
  const weeklyTrend = useWeeklyTrend(token, TREND_WEEKS, refreshSignal);
  const exercises = summaryState.summary?.by_exercise ?? [];

  return (
    <section style={viewStyle}>
      <TrainingOverviewCard
        errorMessage={weeklyTrend.errorMessage}
        isLoading={weeklyTrend.isLoading}
        points={weeklyTrend.points}
      />

      <SectionHeading note="下方卡片随范围切换" title="区间分析" />
      <SegmentedControl
        label="分析范围"
        onChange={setRangeKey}
        options={ANALYSIS_RANGE_OPTIONS.map((option) => ({
          label: option.label,
          value: option.key,
        }))}
        value={rangeKey}
      />

      <AnalysisOverviewCard
        errorMessage={summaryState.errorMessage}
        isLoading={summaryState.isLoading}
        onSelectExercise={(exercise) => {
          setSheetExercise({
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
          });
          props.onExerciseSelect(exercise.exercise_id, exercise.exercise_name);
        }}
        rangeKey={rangeKey}
        requestedRange={range}
        summary={summaryState.summary}
      />

      <MuscleLoadPanel
        errorMessage={muscleLoadState.errorMessage}
        isLoading={muscleLoadState.isLoading}
        muscleLoad={muscleLoadState.muscleLoad}
      />

      <ExerciseProgressPanel
        exercises={exercises}
        onSelectExerciseId={(exerciseId) => {
          const exercise = exercises.find(
            (candidate) => candidate.exercise_id === exerciseId,
          );

          if (exercise) {
            props.onExerciseSelect(
              exercise.exercise_id,
              exercise.exercise_name,
            );
          }
        }}
        range={range}
        refreshSignal={refreshSignal}
        selectedExerciseId={selectedExerciseId}
        token={token}
      />

      <SectionHeading note="按周统计 · 周日起算" title="周趋势" />
      <WeeklyVolumeCard
        errorMessage={weeklyTrend.errorMessage}
        isLoading={weeklyTrend.isLoading}
        points={weeklyTrend.points}
      />
      <BodyPartTrendCard
        errorMessage={weeklyTrend.errorMessage}
        isLoading={weeklyTrend.isLoading}
        points={weeklyTrend.points}
      />

      <ExerciseProgressSheet
        exercise={sheetExercise}
        onClose={() => setSheetExercise(null)}
        range={range}
        rangeKey={rangeKey}
        refreshSignal={refreshSignal}
        token={token}
      />
    </section>
  );
}

function SectionHeading(props: { note: string; title: string }) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        alignItems: "baseline",
        display: "flex",
        justifyContent: "space-between",
        marginTop: 8,
        padding: "0 4px",
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "-0.4px",
          margin: 0,
        }}
      >
        {props.title}
      </h2>
      <span style={{ color: theme.colors.tx3, fontSize: 11 }}>
        {props.note}
      </span>
    </div>
  );
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};
