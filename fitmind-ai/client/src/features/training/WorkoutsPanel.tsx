import { useEffect, useState } from "react";

import type {
  WorkoutDetailDto,
  WorkoutSummaryDto,
} from "../../../../shared/src/training";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { StateNotice } from "../../components/StateNotice";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import { searchExercises } from "./dictionary-api";
import { getExerciseDisplayName } from "./exercise-display";
import { WorkoutCalendar } from "./WorkoutCalendar";
import { usePrefersReducedMotion, MOTION } from "../../components/motion";
import { WorkoutCard } from "./WorkoutCard";
import { WorkoutDetailSheet } from "./WorkoutDetailSheet";

export interface WorkoutsPanelProps {
  deleteError: string | null;
  deletingWorkoutId: string | null;
  detailError: string | null;
  hasMoreWorkouts: boolean;
  isLoadingDetail: boolean;
  isLoadingList: boolean;
  isLoadingMoreWorkouts: boolean;
  listError: string | null;
  onDeleteWorkout: (workoutId: string) => Promise<boolean>;
  onEditWorkout: (workoutId: string) => void;
  /** Calendar grid or chronological list; owned by the page header. */
  viewMode: WorkoutsViewMode;
  onLoadMoreWorkouts: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectWorkout: (workoutId: string) => Promise<void>;
  onWorkoutEdited?: (() => Promise<void>) | undefined;
  selectedWorkout: WorkoutDetailDto | null;
  selectedWorkoutId: string | null;
  token: string | null;
  workouts: WorkoutSummaryDto[];
}

export type WorkoutsViewMode = "list" | "calendar";

export function WorkoutsPanel(props: WorkoutsPanelProps) {
  const { theme } = useTheme();
  const exerciseNames = useExerciseNames();
  const reducedMotion = usePrefersReducedMotion();
  const [pendingDeleteWorkoutId, setPendingDeleteWorkoutId] = useState<
    string | null
  >(null);
  const viewMode = props.viewMode;
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<
    string | null
  >(null);
  // The detail page keeps showing its workout while it slides away, so the
  // open flag and the workout it shows are separate pieces of state.
  const [detailWorkoutId, setDetailWorkoutId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailWorkout =
    props.workouts.find((workout) => workout.id === detailWorkoutId) ?? null;

  // Other sessions logged the same day, so a busy day stays reachable from
  // the detail page without an intermediate list.
  const sameDayWorkouts = detailWorkout
    ? getWorkoutsOnDate(
        props.workouts,
        toLocalDateKey(detailWorkout.performed_at),
      )
    : [];

  return (
    <Card>
      {viewMode === "list" ? (
        <div style={listHeaderStyle}>
          <h2 style={titleStyle}>训练记录</h2>
          <span style={{ color: theme.colors.tx3, fontSize: 12 }}>
            共 {props.workouts.length} 条
          </span>
        </div>
      ) : null}

      <WorkoutDetailSheet
        detail={props.selectedWorkout}
        errorMessage={
          props.detailError ? translateError(props.detailError) : null
        }
        exerciseNames={exerciseNames}
        isDeleting={
          detailWorkoutId !== null &&
          props.deletingWorkoutId === detailWorkoutId
        }
        isLoading={props.isLoadingDetail}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedCalendarDate(null);
        }}
        onDelete={() => {
          if (detailWorkoutId) {
            setPendingDeleteWorkoutId(detailWorkoutId);
          }
        }}
        onEdit={() => {
          if (detailWorkoutId) {
            props.onEditWorkout(detailWorkoutId);
          }
        }}
        onSwitchSession={(workoutId) => void openDetail(workoutId)}
        open={isDetailOpen && detailWorkout !== null}
        sessions={sameDayWorkouts}
        workout={detailWorkout}
      />
      {props.listError ? (
        <StateNotice
          description="请确认服务已启动，或稍后重试。"
          icon="dumbbell"
          title="训练记录加载失败"
          tone="error"
        />
      ) : null}

      {!props.listError && props.deleteError ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description={translateError(props.deleteError)}
            title="删除训练失败"
            tone="error"
          />
        </div>
      ) : null}

      {!props.listError && props.detailError ? (
        <div style={{ marginTop: 12 }}>
          <StateNotice
            description={translateError(props.detailError)}
            title="训练详情加载失败"
            tone="error"
          />
        </div>
      ) : null}

      <ActionSheet
        closeOnBackdrop={props.deletingWorkoutId !== pendingDeleteWorkoutId}
        description="删除后，这条训练记录下的所有动作组也会一起删除。"
        footer={
          <div style={confirmActionRowStyle}>
            <Button
              disabled={props.deletingWorkoutId === pendingDeleteWorkoutId}
              onClick={() => setPendingDeleteWorkoutId(null)}
              type="button"
              variant="secondary"
            >
              取消
            </Button>
            <Button
              disabled={props.deletingWorkoutId === pendingDeleteWorkoutId}
              onClick={() => {
                if (pendingDeleteWorkoutId) {
                  void confirmDeleteWorkout(pendingDeleteWorkoutId);
                }
              }}
              style={dangerConfirmButtonStyle(theme)}
              type="button"
              variant="secondary"
            >
              {props.deletingWorkoutId === pendingDeleteWorkoutId
                ? "删除中..."
                : "删除"}
            </Button>
          </div>
        }
        onClose={() => setPendingDeleteWorkoutId(null)}
        open={pendingDeleteWorkoutId !== null}
        title="删除这条训练记录？"
        tone="danger"
      >
        <p style={confirmCopyStyle(theme)}>
          这个操作无法撤销。建议只在确认记录录错时删除。
        </p>
      </ActionSheet>

      {props.isLoadingList && !props.listError ? (
        <p style={copyStyle(theme)}>正在加载训练记录...</p>
      ) : null}

      {viewMode === "calendar" ? (
        <div
          key="calendar"
          style={{ ...viewEnterStyle(reducedMotion), display: "grid", gap: 12 }}
        >
          <WorkoutCalendar
            hasMoreWorkouts={props.hasMoreWorkouts}
            isLoadingMoreWorkouts={props.isLoadingMoreWorkouts}
            onLoadMoreWorkouts={props.onLoadMoreWorkouts}
            onSelectDate={(date) => void openDay(date)}
            selectedDate={selectedCalendarDate}
            token={props.token}
            workouts={props.workouts}
          />
          <p style={copyStyle(theme)}>点选有训练的日期，查看当天的训练详情。</p>
        </div>
      ) : (
        <div key="list" style={viewEnterStyle(reducedMotion)}>
          {!props.isLoadingList &&
          !props.listError &&
          props.workouts.length === 0 ? (
            <div style={{ marginTop: 14 }}>
              <StateNotice
                description="先记录一次训练，这里会展示你的训练时间、动作和组数。"
                icon="dumbbell"
                title="暂无训练记录"
              />
            </div>
          ) : null}

          {props.workouts.length > 0 ? (
            <div style={listStyle}>
              {renderWorkoutCards(
                isListExpanded
                  ? props.workouts
                  : props.workouts.slice(0, LIST_PREVIEW_COUNT),
              )}
              {renderListFooter()}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );

  /**
   * The list's one footer button.
   *
   * It first expands the records already loaded, then — once they are all
   * visible and the server said there is another page — fetches that page.
   *
   * @returns The footer button, or null when there is nothing left to do
   */
  function renderListFooter(): React.ReactNode {
    const hiddenCount = props.workouts.length - LIST_PREVIEW_COUNT;

    if (!isListExpanded) {
      return hiddenCount > 0 ? (
        <button
          onClick={() => setIsListExpanded(true)}
          style={showMoreStyle(theme)}
          type="button"
        >
          查看更多（还有 {hiddenCount} 条）
        </button>
      ) : null;
    }

    return (
      <div style={footerRowStyle}>
        {props.hasMoreWorkouts ? (
          <button
            disabled={props.isLoadingMoreWorkouts}
            onClick={() => void props.onLoadMoreWorkouts()}
            style={showMoreStyle(theme)}
            type="button"
          >
            {props.isLoadingMoreWorkouts ? "加载中…" : "加载更早的记录"}
          </button>
        ) : null}
        {props.workouts.length > LIST_PREVIEW_COUNT ? (
          <button
            onClick={() => setIsListExpanded(false)}
            style={showMoreStyle(theme)}
            type="button"
          >
            收起
          </button>
        ) : null}
      </div>
    );
  }

  function renderWorkoutCards(list: WorkoutSummaryDto[]): React.ReactNode {
    return list.map((workout) => (
      <WorkoutCard
        isActive={isDetailOpen && detailWorkoutId === workout.id}
        key={workout.id}
        onOpen={() => void openDetail(workout.id)}
        workout={workout}
      />
    ));
  }

  /** Calendar tap: straight to the day's first session, no list step. */
  async function openDay(date: string | null): Promise<void> {
    const [firstWorkout] = date ? getWorkoutsOnDate(props.workouts, date) : [];

    if (!date || !firstWorkout) {
      return;
    }

    setSelectedCalendarDate(date);
    await openDetail(firstWorkout.id);
  }

  async function openDetail(workoutId: string): Promise<void> {
    setDetailWorkoutId(workoutId);
    setIsDetailOpen(true);

    if (props.selectedWorkoutId !== workoutId || !props.selectedWorkout) {
      await props.onSelectWorkout(workoutId);
    }
  }

  async function confirmDeleteWorkout(workoutId: string): Promise<void> {
    const didDelete = await props.onDeleteWorkout(workoutId);

    if (didDelete) {
      setPendingDeleteWorkoutId(null);
      setIsDetailOpen(false);
    }
  }
}

function translateError(message: string): string {
  return message
    .replaceAll(
      "Workout list is unavailable right now.",
      "训练记录加载失败，请稍后重试。",
    )
    .replaceAll(
      "Workout detail is unavailable right now.",
      "训练详情加载失败，请稍后重试。",
    )
    .replaceAll(
      "Workout deletion is unavailable right now.",
      "删除失败，请稍后重试。",
    )
    .replaceAll(
      "You must be signed in to view workouts.",
      "请先登录后再查看训练记录。",
    )
    .replaceAll(
      "You must be signed in to view workout details.",
      "请先登录后再查看训练详情。",
    )
    .replaceAll(
      "You must be signed in to delete workouts.",
      "请先登录后再删除训练记录。",
    );
}

function useExerciseNames(): Map<string, string> {
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(
    new Map(),
  );

  useEffect(() => {
    let isActive = true;

    async function loadExerciseNames(): Promise<void> {
      try {
        const exercises = await searchExercises({});

        if (!isActive) {
          return;
        }

        setExerciseNames(
          new Map(
            exercises.map((exercise) => {
              return [exercise.id, getExerciseDisplayName(exercise)] as const;
            }),
          ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (!(error instanceof HttpClientError)) {
          return;
        }

        setExerciseNames(new Map());
      }
    }

    void loadExerciseNames();

    return () => {
      isActive = false;
    };
  }, []);

  return exerciseNames;
}

const listHeaderStyle: React.CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  gap: 8,
  marginBottom: 12,
};

/** Calendar ⇄ list swap: a short fade-rise, not a hard cut. */
function viewEnterStyle(reducedMotion: boolean): React.CSSProperties {
  return reducedMotion
    ? {}
    : {
        animation: `fmViewIn ${MOTION.quickMs + 60}ms ${MOTION.standard} both`,
      };
}

/** Workouts on one local day, earliest first. */
function getWorkoutsOnDate(
  workouts: WorkoutSummaryDto[],
  date: string,
): WorkoutSummaryDto[] {
  return workouts
    .filter((workout) => toLocalDateKey(workout.performed_at) === date)
    .sort(
      (left, right) =>
        new Date(left.performed_at).getTime() -
        new Date(right.performed_at).getTime(),
    );
}

/** Local calendar-day key (YYYY-MM-DD) from a workout's performed_at. */
function toLocalDateKey(performedAt: string): string {
  const date = new Date(performedAt);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** How many records the list shows before "查看更多" is needed. */
const LIST_PREVIEW_COUNT = 5;

const footerRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

/** Design: dashed full-width control that reveals the rest of the records. */
function showMoreStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px dashed ${theme.colors.grab}`,
    borderRadius: 10,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: 10,
  };
}

/** Compact pill button used by the record-panel header (view toggle / refresh). */

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

function confirmCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  };
}

const confirmActionRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

function dangerConfirmButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderColor: theme.colors.red,
    color: theme.colors.red,
  };
}
