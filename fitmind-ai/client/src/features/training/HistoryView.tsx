import { useState } from "react";

import type { HistoryViewMode } from "../../app-navigation";
import type { ExercisePickerProps } from "./ExercisePicker";
import type { AnalysisViewProps } from "./AnalysisView";
import type { TrainingSessionInitialDraft } from "./training-session-draft";
import type { WorkoutsPanelProps, WorkoutsViewMode } from "./WorkoutsPanel";

import { MOTION } from "../../components/motion";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useTheme } from "../../theme/ThemeContext";
import { AnalysisView } from "./AnalysisView";
import { TrainingSessionComposer } from "./TrainingSessionComposer";
import { WorkoutsPanel } from "./WorkoutsPanel";
import { getWorkoutDetail } from "./workout-api";
import { mapWorkoutToSessionInitialDraft } from "./workout-to-session-draft";

export interface HistoryViewProps {
  analysisProps: AnalysisViewProps;
  exercisePickerProps: ExercisePickerProps;
  onModeChange?: ((mode: HistoryViewMode) => void) | undefined;
  token: string | null;
  workoutsProps: Omit<WorkoutsPanelProps, "onEditWorkout" | "viewMode">;
}

/**
 * Shared history destination. Training records remain the default view, while
 * the former standalone analysis page is one deliberate switch away.
 */
export function HistoryView(props: HistoryViewProps) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<HistoryViewMode>("history");
  const [workoutsViewMode, setWorkoutsViewMode] =
    useState<WorkoutsViewMode>("calendar");
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [initialDraft, setInitialDraft] =
    useState<TrainingSessionInitialDraft | null>(null);

  return (
    <section style={viewStyle}>
      <div style={headerRowStyle}>
        <div style={modeControlStyle}>
          <SegmentedControl
            label="历史页面视图"
            onChange={handleModeChange}
            options={[
              { label: "历史", value: "history" },
              { label: "分析", value: "analysis" },
            ]}
            value={mode}
          />
        </div>
        <div
          aria-hidden={mode !== "history"}
          style={actionsStyle(mode === "history")}
        >
          <button
            onClick={() =>
              setWorkoutsViewMode((current) =>
                current === "list" ? "calendar" : "list",
              )
            }
            style={miniButtonStyle(theme, true)}
            tabIndex={mode === "history" ? 0 : -1}
            type="button"
          >
            {workoutsViewMode === "list" ? "日历视图" : "列表视图"}
          </button>
          <button
            disabled={props.workoutsProps.isLoadingList}
            onClick={() => void props.workoutsProps.onRefresh()}
            style={miniButtonStyle(theme, false)}
            tabIndex={mode === "history" ? 0 : -1}
            type="button"
          >
            {props.workoutsProps.isLoadingList ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <section
        aria-hidden={mode !== "history"}
        style={contentStyle(mode === "history", "fmSlideFromLeft")}
      >
        <WorkoutsPanel
          {...props.workoutsProps}
          onEditWorkout={(workoutId) => void handleEditWorkout(workoutId)}
          viewMode={workoutsViewMode}
        />
      </section>

      <section
        aria-hidden={mode !== "analysis"}
        style={contentStyle(mode === "analysis", "fmSlideFromRight")}
      >
        <AnalysisView {...props.analysisProps} />
      </section>

      <TrainingSessionComposer
        exerciseLibraryProps={props.exercisePickerProps}
        initialDraft={initialDraft}
        isOpen={editingWorkoutId !== null}
        mode="edit_existing"
        onCancel={closeEditor}
        onCreated={handleWorkoutEdited}
        token={props.token}
      />
    </section>
  );

  function handleModeChange(nextMode: HistoryViewMode): void {
    setMode(nextMode);
    props.onModeChange?.(nextMode);
  }

  async function handleEditWorkout(workoutId: string): Promise<void> {
    if (!props.token) {
      return;
    }

    const detail =
      props.workoutsProps.selectedWorkoutId === workoutId &&
      props.workoutsProps.selectedWorkout
        ? props.workoutsProps.selectedWorkout
        : await getWorkoutDetail(props.token, workoutId);

    setInitialDraft(
      mapWorkoutToSessionInitialDraft(
        detail,
        props.exercisePickerProps.exercises,
      ),
    );
    setEditingWorkoutId(workoutId);
  }

  async function handleWorkoutEdited(): Promise<void> {
    if (!editingWorkoutId) {
      closeEditor();
      return;
    }

    if (props.workoutsProps.onWorkoutEdited) {
      await props.workoutsProps.onWorkoutEdited();
    } else {
      await props.workoutsProps.onRefresh();
    }
    await props.workoutsProps.onSelectWorkout(editingWorkoutId);
    closeEditor();
  }

  function closeEditor(): void {
    setEditingWorkoutId(null);
    setInitialDraft(null);
  }
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const headerRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
  marginTop: 2,
};

const modeControlStyle: React.CSSProperties = {
  flex: "0 0 168px",
};

function actionsStyle(isVisible: boolean): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    opacity: isVisible ? 1 : 0,
    pointerEvents: isVisible ? "auto" : "none",
    transform: isVisible ? "none" : "translateX(8px)",
    transition: `opacity ${MOTION.quickMs}ms ${MOTION.standard}, transform ${MOTION.quickMs}ms ${MOTION.standard}`,
  };
}

function miniButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isAccent: boolean,
): React.CSSProperties {
  return {
    background: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: isAccent ? theme.colors.ac : theme.colors.tx2,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 11px",
    whiteSpace: "nowrap",
  };
}

/**
 * Both panes stay mounted so their state survives switching; the one coming
 * in replays a short slide from the side its segment sits on.
 */
function contentStyle(
  isActive: boolean,
  enterAnimation: "fmSlideFromLeft" | "fmSlideFromRight",
): React.CSSProperties {
  return {
    animation: isActive
      ? `${enterAnimation} ${MOTION.quickMs + 80}ms ${MOTION.standard} both`
      : undefined,
    display: isActive ? "grid" : "none",
    gap: 16,
  };
}
