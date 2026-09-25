import { useEffect, useMemo, useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { DictionaryExercise } from "./dictionary-api";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { SlideUpPage } from "../../components/SlideUpPage";
import { StateNotice } from "../../components/StateNotice";
import { usePrefersReducedMotion } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { createAnalysisRange } from "./analysis-range";
import { ExerciseLibraryScreen } from "./ExerciseLibraryScreen";
import {
  ExerciseProgressSheet,
  type ExerciseProgressSheetExercise,
} from "./ExerciseProgressSheet";
import {
  TrainingSessionHeader,
  TrainingSessionMinimizedPill,
  TrainingSessionToolbar,
  type ToolbarAction,
} from "./TrainingSessionChrome";
import { TrainingSessionEmptyState } from "./TrainingSessionEmptyState";
import { TrainingSessionExerciseCard } from "./TrainingSessionExerciseCard";
import { SessionIcon } from "./TrainingSessionIcons";
import { TrainingSessionNotesPage } from "./TrainingSessionNotesPage";
import {
  TrainingSessionPopover,
  type PopoverAnchor,
  type PopoverMenuItem,
} from "./TrainingSessionPopover";
import {
  TrainingSessionRestTimer,
  type RestTimerState,
} from "./TrainingSessionRestTimer";
import { TrainingSessionReveal } from "./TrainingSessionReveal";
import {
  createDraftExercise,
  getCompletedValidSetCount,
  getExerciseLoadType,
  isDraftSetValid,
  type DraftExercise,
  type DraftSet,
  type TrainingSessionInitialDraft,
} from "./training-session-draft";
import { getSessionProgress } from "./training-session-progress";
import {
  appendNextSetAfterCompletion,
  clearDraftSetValues,
  completeDraftSetWithRest,
  toggleExpandedExercise,
} from "./training-session-set-actions";
import {
  addDraftSet,
  copyDraftSet,
  deleteDraftSet,
  toggleDraftSetCompleted,
  updateDraftSet,
} from "./training-session-set-state";
import {
  formatDateTimeLocalValue,
  formatTrainingTimeSummary,
  getDurationMinutesFromLocalValues,
  parseDateTimeLocalValue,
} from "./training-time";
import {
  getExerciseCategoryLabel as getDisplayExerciseCategoryLabel,
  getExerciseDisplayName,
} from "./exercise-display";
import { WorkoutIntakePanel } from "./WorkoutIntakePanel";
import type { WorkoutIntakeDraft } from "./workout-intake-api";
import {
  appendIntakeExercisesToDraft,
  mapWorkoutIntakeDraftToSessionInitialDraft,
} from "./workout-intake-to-session-draft";
import {
  executeTrainingSessionSave,
  prepareTrainingSessionSave,
} from "./training-session-save";

export interface TrainingSessionComposerProps {
  exerciseLibraryProps: ExercisePickerProps;
  initialDraft?: TrainingSessionInitialDraft | null | undefined;
  isOpen: boolean;
  mode?: "create_active" | "create_from_intake" | "edit_existing" | undefined;
  onCancel: () => void;
  onCreated?: (() => Promise<void>) | undefined;
  token: string | null;
}

/** Rest length used when ticking a set starts the countdown automatically. */
const DEFAULT_REST_SECONDS = 90;

/**
 * The 训练记录 page, used to log a live workout and to edit a past one.
 *
 * Slides up over the app as a full page (above the history detail page),
 * modelled on 训记's session screen: big clock, done/total progress,
 * accordion exercise cards with per-set tiles, anchored menus, and a bottom
 * toolbar. A live session can be minimized to a floating capsule.
 *
 * @param props - Mode, initial draft and lifecycle callbacks
 * @returns Session page and its overlays
 */
export function TrainingSessionComposer(props: TrainingSessionComposerProps) {
  const { theme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftDurationMin, setDraftDurationMin] = useState<number | null>(null);
  const [draftEndedAt, setDraftEndedAt] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftPerformedAt, setDraftPerformedAt] = useState<string | null>(null);
  const [draftStartedAt, setDraftStartedAt] = useState<string | null>(null);
  const [historyExercise, setHistoryExercise] =
    useState<ExerciseProgressSheetExercise | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  /** Set once the save went through, so a slow close can't save twice. */
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimeEditorOpen, setIsTimeEditorOpen] = useState(false);
  const [leavingExerciseIds, setLeavingExerciseIds] = useState<string[]>([]);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<PopoverAnchor | null>(
    null,
  );
  const [pendingExerciseRemovalId, setPendingExerciseRemovalId] = useState<
    string | null
  >(null);
  const [pendingRestTimerRequest, setPendingRestTimerRequest] = useState<{
    setId: string | undefined;
  } | null>(null);
  const [pendingScrollExerciseId, setPendingScrollExerciseId] = useState<
    string | null
  >(null);
  const [replacingDraftExerciseId, setReplacingDraftExerciseId] = useState<
    string | null
  >(null);
  const [restPresetSeconds, setRestPresetSeconds] =
    useState(DEFAULT_REST_SECONDS);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [isVoiceSheetOpen, setIsVoiceSheetOpen] = useState(false);
  const [appendNotice, setAppendNotice] = useState<string | null>(null);
  const mode = props.mode ?? "create_active";
  const isActiveSession = mode === "create_active";
  const historyRange = useMemo(() => createAnalysisRange("all"), []);

  useEffect(() => {
    if (!props.isOpen || !isActiveSession || !isRunning) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((currentValue) => currentValue + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isActiveSession, isRunning, props.isOpen]);

  // Start every visit from a clean (or the supplied) draft. Resetting on open
  // rather than on close keeps the content on screen while the page slides
  // away.
  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    resetComposerState();

    if (!props.initialDraft) {
      return;
    }

    setDraftExercises(props.initialDraft.exercises);
    setElapsedSeconds((props.initialDraft.durationMin ?? 0) * 60);
    setDraftDurationMin(props.initialDraft.durationMin);
    setDraftEndedAt(props.initialDraft.endedAt ?? null);
    setDraftNote(props.initialDraft.note ?? "");
    setDraftPerformedAt(props.initialDraft.performedAt);
    setDraftStartedAt(props.initialDraft.startedAt ?? null);
    setIsRunning(false);
  }, [props.initialDraft, props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || restTimer?.status !== "running") {
      return;
    }

    const timerId = window.setInterval(() => {
      setRestTimer((currentValue) => {
        if (!currentValue || currentValue.status !== "running") {
          return currentValue;
        }

        const nextRemainingSeconds = currentValue.remainingSeconds - 1;

        if (nextRemainingSeconds <= 0) {
          return {
            ...currentValue,
            isRunning: false,
            remainingSeconds: 0,
            status: "finished",
          };
        }

        return {
          ...currentValue,
          remainingSeconds: nextRemainingSeconds,
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [props.isOpen, restTimer?.status]);

  useEffect(() => {
    if (!pendingScrollExerciseId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`training-session-exercise-${pendingScrollExerciseId}`)
        ?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "nearest",
        });
      setPendingScrollExerciseId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingScrollExerciseId, reducedMotion]);

  const completedValidSetCount = getCompletedValidSetCount(draftExercises);
  const progress = getSessionProgress(draftExercises);
  const hasExpandedExercise = draftExercises.some((item) => item.isExpanded);
  const timeSummary = formatTrainingTimeSummary({
    durationMin: draftDurationMin,
    endedAt: draftEndedAt,
    performedAt: draftPerformedAt,
    startedAt: draftStartedAt,
  });
  const notesAction: ToolbarAction = {
    icon: "note",
    isMarked: draftNote.trim().length > 0,
    key: "notes",
    label: "写心得",
    onClick: () => setIsNotesOpen(true),
  };
  const moreAction: ToolbarAction = {
    icon: "more-grid",
    key: "more",
    label: "更多",
    onClick: (trigger) => setMoreMenuAnchor(trigger.getBoundingClientRect()),
  };
  const toolbarLeading: ToolbarAction[] = isActiveSession
    ? [
        {
          icon: "minimize",
          key: "minimize",
          label: "最小化",
          onClick: () => setIsMinimized(true),
        },
        moreAction,
      ]
    : [moreAction];
  const toolbarTrailing: ToolbarAction[] = isActiveSession
    ? [
        notesAction,
        {
          icon: "timer",
          key: "rest",
          label: "休息",
          onClick: () => handleOpenRestTimer(getLastCompletedSetId()),
        },
      ]
    : [notesAction];

  return (
    <>
      <SlideUpPage
        ariaLabel="训练记录"
        footer={
          <>
            <TrainingSessionRestTimer
              onClose={() => setRestTimer(null)}
              onConfirmDuration={handleConfirmRestTimerDuration}
              onToggleRunning={handleToggleRestTimerRunning}
              timer={restTimer}
            />
            <TrainingSessionToolbar
              leading={toolbarLeading}
              onAdd={() => void handleOpenLibrary()}
              trailing={toolbarTrailing}
            />
            <ExerciseLibraryScreen
              isOpen={isLibraryOpen}
              mode={replacingDraftExerciseId ? "replace" : "add"}
              onClose={() => {
                setIsLibraryOpen(false);
                setReplacingDraftExerciseId(null);
              }}
              onSelectExercise={handleSelectExercise}
              token={props.token}
              {...props.exerciseLibraryProps}
            />
          </>
        }
        header={
          <TrainingSessionHeader
            canComplete={completedValidSetCount > 0 && !isSaved}
            durationMin={draftDurationMin}
            elapsedSeconds={elapsedSeconds}
            isActiveSession={isActiveSession}
            isRunning={isRunning}
            isSubmitting={isSubmitting}
            onCancel={handleCancel}
            onComplete={() => void handleComplete()}
            onEditTime={openTimeEditor}
            onToggleRunning={handleToggleSessionRunning}
            progress={progress}
            timeSummary={timeSummary}
          />
        }
        onClose={handleEscape}
        open={props.isOpen && !isMinimized}
        variant="full"
      >
        <main onClick={collapseExpandedExercises} style={bodyStyle}>
          {duplicateNotice ? (
            <TrainingSessionReveal
              key={`duplicate-${duplicateNotice}`}
              spacing={12}
            >
              <StateNotice
                description={duplicateNotice}
                title="动作已存在"
                tone="warning"
              />
            </TrainingSessionReveal>
          ) : null}

          {errorMessage ? (
            <TrainingSessionReveal key={`error-${errorMessage}`} spacing={12}>
              <StateNotice
                description={translateErrorMessage(errorMessage)}
                title="训练保存失败"
                tone="error"
              />
            </TrainingSessionReveal>
          ) : null}

          {appendNotice ? (
            <TrainingSessionReveal key={`append-${appendNotice}`} spacing={12}>
              <StateNotice description={appendNotice} title="已追加动作" />
            </TrainingSessionReveal>
          ) : null}

          {draftExercises.length === 0 ? (
            <TrainingSessionEmptyState
              onAddActionClick={() => void handleOpenLibrary()}
            />
          ) : (
            <div>
              {draftExercises.map((draftExercise, index) => (
                <TrainingSessionReveal
                  isLeaving={leavingExerciseIds.includes(draftExercise.id)}
                  key={draftExercise.id}
                  onExited={() => finishRemoveExercise(draftExercise.id)}
                  spacing={12}
                >
                  <TrainingSessionExerciseCard
                    canMoveDown={index < draftExercises.length - 1}
                    canMoveUp={index > 0}
                    draftExercise={draftExercise}
                    onAddSet={() => handleAddSet(draftExercise.id)}
                    onClearSet={(setId) =>
                      handleClearSet(draftExercise.id, setId)
                    }
                    onCopySet={(setId) =>
                      handleCopySet(draftExercise.id, setId)
                    }
                    onDeleteSet={(setId) =>
                      handleDeleteSet(draftExercise.id, setId)
                    }
                    onMoveDown={() =>
                      handleMoveExercise(draftExercise.id, "down")
                    }
                    onMoveUp={() => handleMoveExercise(draftExercise.id, "up")}
                    onRemove={() => handleRemoveExercise(draftExercise.id)}
                    onReplace={() =>
                      handleStartReplaceExercise(draftExercise.id)
                    }
                    onResolveCandidate={handleResolveCandidate}
                    onShowHistory={getShowHistoryHandler(draftExercise)}
                    onStartRestTimer={handleOpenRestTimer}
                    onToggleExpanded={() =>
                      handleToggleExpanded(draftExercise.id)
                    }
                    onToggleSetCompleted={(setId) =>
                      handleToggleSetCompleted(draftExercise.id, setId)
                    }
                    onUpdateSet={(setId, field, value) =>
                      handleUpdateSet(draftExercise.id, setId, field, value)
                    }
                  />
                </TrainingSessionReveal>
              ))}
            </div>
          )}

          {draftNote.trim() ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                setIsNotesOpen(true);
              }}
              style={notePreviewStyle(theme)}
              type="button"
            >
              <span style={notePreviewHeadStyle(theme)}>
                <SessionIcon name="note" size={16} />
                训练备注
              </span>
              <span style={notePreviewTextStyle(theme)}>{draftNote}</span>
            </button>
          ) : null}
        </main>
      </SlideUpPage>

      <TrainingSessionMinimizedPill
        elapsedSeconds={elapsedSeconds}
        isRunning={isRunning}
        onRestore={() => setIsMinimized(false)}
        open={props.isOpen && isMinimized}
      />

      <TrainingSessionNotesPage
        note={draftNote}
        onClose={() => setIsNotesOpen(false)}
        onSave={(nextNote) => {
          setDraftNote(nextNote);
          setIsNotesOpen(false);
        }}
        open={props.isOpen && isNotesOpen}
      />

      <TrainingSessionPopover
        anchor={moreMenuAnchor}
        ariaLabel="更多操作"
        items={buildMoreMenu()}
        onClose={() => setMoreMenuAnchor(null)}
      />

      <ActionSheet
        description="说出动作、重量、次数和组数，确认后会追加到本次训练，不会覆盖已记录的动作。"
        onClose={() => setIsVoiceSheetOpen(false)}
        open={props.isOpen && isVoiceSheetOpen}
        title="语音追加动作"
      >
        <WorkoutIntakePanel
          exerciseLibraryProps={props.exerciseLibraryProps}
          onDraftParsed={handleAppendIntakeDraft}
          token={props.token}
        />
      </ActionSheet>

      <ActionSheet
        footer={
          <div style={confirmActionRowStyle}>
            <Button
              onClick={() => setPendingExerciseRemovalId(null)}
              type="button"
              variant="secondary"
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (pendingExerciseRemovalId) {
                  confirmRemoveExercise(pendingExerciseRemovalId);
                }
              }}
              style={dangerConfirmButtonStyle(theme)}
              type="button"
              variant="secondary"
            >
              移除
            </Button>
          </div>
        }
        onClose={() => setPendingExerciseRemovalId(null)}
        open={props.isOpen && pendingExerciseRemovalId !== null}
        title="移除这个动作？"
        tone="danger"
      >
        <p style={confirmCopyStyle(theme)}>该动作下的训练组也会一起移除。</p>
      </ActionSheet>

      <ActionSheet
        footer={
          <div style={confirmActionRowStyle}>
            <Button
              onClick={() => setPendingRestTimerRequest(null)}
              type="button"
              variant="secondary"
            >
              取消
            </Button>
            <Button
              onClick={() => {
                openRestTimerSelector(pendingRestTimerRequest?.setId);
                setPendingRestTimerRequest(null);
              }}
              type="button"
            >
              替换
            </Button>
          </div>
        }
        onClose={() => setPendingRestTimerRequest(null)}
        open={props.isOpen && pendingRestTimerRequest !== null}
        title="已有休息倒计时正在进行，是否替换？"
      >
        <p style={confirmCopyStyle(theme)}>
          新的倒计时会替换当前正在进行的休息。
        </p>
      </ActionSheet>

      <TrainingTimeEditor
        endedAt={draftEndedAt}
        onClose={() => setIsTimeEditorOpen(false)}
        onSave={(nextValue) => {
          setDraftStartedAt(nextValue.startedAt);
          setDraftEndedAt(nextValue.endedAt);
          setDraftDurationMin(nextValue.durationMin);
          if (nextValue.startedAt) {
            setDraftPerformedAt(nextValue.startedAt);
          }
          setIsTimeEditorOpen(false);
        }}
        open={props.isOpen && isTimeEditorOpen}
        performedAt={draftPerformedAt}
        startedAt={draftStartedAt}
      />

      {props.isOpen ? (
        <ExerciseProgressSheet
          exercise={historyExercise}
          onClose={() => setHistoryExercise(null)}
          range={historyRange}
          rangeKey="all"
          refreshSignal={0}
          token={props.token}
        />
      ) : null}
    </>
  );

  function buildMoreMenu(): PopoverMenuItem[] {
    const items: PopoverMenuItem[] = [
      {
        key: "voice",
        label: "语音追加动作",
        onSelect: () => {
          setDuplicateNotice(null);
          setErrorMessage(null);
          setAppendNotice(null);
          setIsVoiceSheetOpen(true);
        },
      },
    ];

    if (!isActiveSession) {
      items.push({
        key: "time",
        label: "修改训练时间",
        onSelect: openTimeEditor,
      });
    }

    items.push({
      disabled: !hasExpandedExercise,
      key: "collapse",
      label: "全部收起",
      onSelect: collapseExpandedExercises,
    });

    return items;
  }

  function getShowHistoryHandler(
    draftExercise: DraftExercise,
  ): (() => void) | undefined {
    const exerciseId = draftExercise.exerciseId;

    if (
      !props.token ||
      !exerciseId ||
      draftExercise.matchStatus !== "matched"
    ) {
      return undefined;
    }

    return () =>
      setHistoryExercise({
        exercise_id: exerciseId,
        exercise_name: draftExercise.name,
      });
  }

  function handleEscape(): void {
    // Overlays on top of the page handle their own Escape; only the bare
    // page reacts, and only non-destructively (a live session minimizes).
    if (
      isLibraryOpen ||
      isNotesOpen ||
      isVoiceSheetOpen ||
      isTimeEditorOpen ||
      moreMenuAnchor ||
      historyExercise ||
      pendingExerciseRemovalId ||
      pendingRestTimerRequest ||
      restTimer?.status === "selecting"
    ) {
      return;
    }

    if (isActiveSession) {
      setIsMinimized(true);
    }
  }

  function handleCancel(): void {
    if (isSubmitting) {
      return;
    }

    props.onCancel();
  }

  function openTimeEditor(): void {
    setIsTimeEditorOpen(true);
  }

  async function handleOpenLibrary(): Promise<void> {
    setDuplicateNotice(null);
    setErrorMessage(null);
    setAppendNotice(null);
    setReplacingDraftExerciseId(null);
    setIsLibraryOpen(true);
  }

  function handleAppendIntakeDraft(draft: WorkoutIntakeDraft): void {
    const mapped = mapWorkoutIntakeDraftToSessionInitialDraft(
      draft,
      props.exerciseLibraryProps.exercises,
    );
    const result = appendIntakeExercisesToDraft(
      draftExercises,
      mapped.exercises,
    );
    const appendedCount = result.addedCount + result.mergedCount;

    setDraftExercises(result.next);
    setAppendNotice(
      appendedCount > 0
        ? `已通过语音追加 ${appendedCount} 个动作到本次训练。`
        : "没有识别到可追加的动作。",
    );
    setIsVoiceSheetOpen(false);
  }

  function handleSelectExercise(exercise: DictionaryExercise): void {
    if (replacingDraftExerciseId) {
      const alreadyExists = draftExercises.some((item) => {
        return (
          item.id !== replacingDraftExerciseId &&
          item.exerciseId === exercise.id
        );
      });

      if (alreadyExists) {
        setDuplicateNotice("这个动作已经在本次训练中，不能替换为重复动作。");
      } else {
        setDuplicateNotice(null);
        setDraftExercises((currentValue) =>
          currentValue.map((draftExercise) => {
            if (draftExercise.id !== replacingDraftExerciseId) {
              return draftExercise;
            }

            return {
              ...draftExercise,
              categoryLabel: getDisplayExerciseCategoryLabel(exercise),
              exercise,
              exerciseId: exercise.id,
              loadType: getExerciseLoadType(exercise),
              matchStatus: "matched",
              name: getExerciseDisplayName(exercise),
            };
          }),
        );
      }
    } else if (draftExercises.some((item) => item.exerciseId === exercise.id)) {
      setDuplicateNotice("这个动作已经在本次训练中");
    } else {
      const addedExercise = createDraftExercise(
        exercise,
        getDisplayExerciseCategoryLabel(exercise),
      );

      setDuplicateNotice(null);
      setDraftExercises((currentValue) =>
        toggleExpandedExercise(
          [...currentValue, addedExercise],
          addedExercise.id,
        ),
      );
      setPendingScrollExerciseId(addedExercise.id);
    }

    setIsLibraryOpen(false);
    setReplacingDraftExerciseId(null);
  }

  function handleToggleExpanded(exerciseId: string): void {
    setDraftExercises((currentValue) =>
      toggleExpandedExercise(currentValue, exerciseId),
    );
  }

  function handleToggleSessionRunning(): void {
    if (!isRunning && !draftStartedAt) {
      setDraftStartedAt(new Date().toISOString());
    }

    setIsRunning(!isRunning);
  }

  function collapseExpandedExercises(): void {
    setDraftExercises((currentValue) => {
      return currentValue.map((draftExercise) => {
        if (!draftExercise.isExpanded) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          isExpanded: false,
        };
      });
    });
  }

  function handleStartReplaceExercise(exerciseId: string): void {
    setDuplicateNotice(null);
    setErrorMessage(null);
    setReplacingDraftExerciseId(exerciseId);
    setIsLibraryOpen(true);
  }

  function handleMoveExercise(
    exerciseId: string,
    direction: "up" | "down",
  ): void {
    setDraftExercises((currentValue) => {
      const sourceIndex = currentValue.findIndex((draftExercise) => {
        return draftExercise.id === exerciseId;
      });

      if (sourceIndex < 0) {
        return currentValue;
      }

      const targetIndex =
        direction === "up" ? sourceIndex - 1 : sourceIndex + 1;

      if (targetIndex < 0 || targetIndex >= currentValue.length) {
        return currentValue;
      }

      const nextValue = [...currentValue];
      const [movedExercise] = nextValue.splice(sourceIndex, 1);

      if (!movedExercise) {
        return currentValue;
      }

      nextValue.splice(targetIndex, 0, movedExercise);
      return nextValue;
    });
  }

  function handleRemoveExercise(exerciseId: string): void {
    const targetExercise = draftExercises.find((draftExercise) => {
      return draftExercise.id === exerciseId;
    });

    if (!targetExercise) {
      return;
    }

    if (targetExercise.sets.length > 0) {
      setPendingExerciseRemovalId(exerciseId);
      return;
    }

    startRemoveExercise(exerciseId);
  }

  function confirmRemoveExercise(exerciseId: string): void {
    setPendingExerciseRemovalId(null);
    startRemoveExercise(exerciseId);
  }

  /** Collapses the card away first; {@link finishRemoveExercise} drops it. */
  function startRemoveExercise(exerciseId: string): void {
    setLeavingExerciseIds((currentValue) =>
      currentValue.includes(exerciseId)
        ? currentValue
        : [...currentValue, exerciseId],
    );
  }

  function finishRemoveExercise(exerciseId: string): void {
    setDraftExercises((currentValue) => {
      return currentValue.filter(
        (draftExercise) => draftExercise.id !== exerciseId,
      );
    });
    setLeavingExerciseIds((currentValue) =>
      currentValue.filter((id) => id !== exerciseId),
    );
  }

  function handleAddSet(exerciseId: string): void {
    setDraftExercises((currentValue) => addDraftSet(currentValue, exerciseId));
  }

  function handleCopySet(exerciseId: string, setId: string): void {
    setDraftExercises((currentValue) =>
      copyDraftSet(currentValue, exerciseId, setId),
    );
  }

  function handleClearSet(exerciseId: string, setId: string): void {
    setDraftExercises((currentValue) =>
      clearDraftSetValues(currentValue, exerciseId, setId),
    );
  }

  function handleDeleteSet(exerciseId: string, setId: string): void {
    setDraftExercises((currentValue) =>
      deleteDraftSet(currentValue, exerciseId, setId),
    );
  }

  function handleUpdateSet<TField extends keyof DraftSet>(
    exerciseId: string,
    setId: string,
    field: TField,
    value: DraftSet[TField],
  ): void {
    setDraftExercises((currentValue) =>
      updateDraftSet(currentValue, exerciseId, setId, field, value),
    );
  }

  /**
   * Ticks or un-ticks a set. In a live session a successful tick also
   * prefills the next set and starts the rest countdown (训记 behavior).
   */
  function handleToggleSetCompleted(exerciseId: string, setId: string): void {
    const exercise = draftExercises.find((item) => item.id === exerciseId);
    const setDraft = exercise?.sets.find((item) => item.id === setId);
    const willComplete = Boolean(
      exercise &&
      setDraft &&
      !setDraft.completed &&
      isDraftSetValid(setDraft, exercise),
    );

    setDraftExercises((currentValue) => {
      const toggled = toggleDraftSetCompleted(currentValue, exerciseId, setId);

      return isActiveSession
        ? appendNextSetAfterCompletion(currentValue, toggled, exerciseId, setId)
        : toggled;
    });

    if (willComplete && isActiveSession) {
      startRestCountdown(setId, restPresetSeconds);
    }
  }

  function getLastCompletedSetId(): string | undefined {
    const completedSets = draftExercises.flatMap((draftExercise) =>
      draftExercise.sets.filter((setDraft) => setDraft.completed),
    );

    return completedSets.at(-1)?.id;
  }

  function handleOpenRestTimer(setId: string | undefined): void {
    if (
      restTimer &&
      (restTimer.status === "running" ||
        restTimer.status === "paused" ||
        restTimer.status === "selecting") &&
      (restTimer.remainingSeconds > 0 || restTimer.status === "selecting")
    ) {
      setPendingRestTimerRequest({ setId });
      return;
    }

    openRestTimerSelector(setId);
  }

  function openRestTimerSelector(setId: string | undefined): void {
    setRestTimer({
      isRunning: false,
      remainingSeconds: 0,
      sourceSetId: setId,
      status: "selecting",
      totalSeconds: 0,
    });
  }

  function handleConfirmRestTimerDuration(seconds: number): void {
    const safeSeconds = Math.max(1, Math.floor(seconds));

    setRestPresetSeconds(safeSeconds);
    startRestCountdown(restTimer?.sourceSetId, safeSeconds);
  }

  /** Runs the countdown and records it against the set it follows, if any. */
  function startRestCountdown(
    sourceSetId: string | undefined,
    seconds: number,
  ): void {
    if (sourceSetId) {
      setDraftExercises((currentValue) => {
        const next = completeDraftSetWithRest(
          currentValue,
          sourceSetId,
          seconds,
        );
        const exerciseId = currentValue.find((draftExercise) =>
          draftExercise.sets.some((setDraft) => setDraft.id === sourceSetId),
        )?.id;

        return isActiveSession && exerciseId
          ? appendNextSetAfterCompletion(
              currentValue,
              next,
              exerciseId,
              sourceSetId,
            )
          : next;
      });
    }

    setRestTimer({
      isRunning: true,
      remainingSeconds: seconds,
      sourceSetId,
      status: "running",
      totalSeconds: seconds,
    });
  }

  function handleToggleRestTimerRunning(): void {
    setRestTimer((currentValue) => {
      if (
        !currentValue ||
        currentValue.status === "finished" ||
        currentValue.status === "selecting"
      ) {
        return currentValue;
      }

      if (currentValue.status === "paused") {
        return {
          ...currentValue,
          isRunning: true,
          status: "running",
        };
      }

      return {
        ...currentValue,
        isRunning: false,
        status: "paused",
      };
    });
  }

  async function handleComplete(): Promise<void> {
    if (!props.token) {
      setErrorMessage("You must be signed in to create a workout.");
      return;
    }

    const savePlan = prepareTrainingSessionSave({
      draftDurationMin,
      draftEndedAt,
      draftExercises,
      draftNote,
      draftPerformedAt,
      draftStartedAt,
      elapsedSeconds,
      initialDraft: props.initialDraft,
      mode,
      now: new Date(),
    });

    if (!savePlan) {
      setErrorMessage(
        "Please fix the highlighted workout fields and try again.",
      );
      return;
    }

    setDuplicateNotice(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await executeTrainingSessionSave(props.token, savePlan);
      setIsSaved(true);
      await props.onCreated?.();
    } catch (error) {
      setErrorMessage(getReadableErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleResolveCandidate(exerciseId: string): void {
    const exercise = props.exerciseLibraryProps.exercises.find(
      (item) => item.id === exerciseId,
    );

    if (!exercise) {
      setDuplicateNotice("请打开动作库重新选择该动作。");
      return;
    }

    const targetExercise = draftExercises.find((draftExercise) =>
      draftExercise.candidateExercises.some(
        (candidate) => candidate.exerciseId === exerciseId,
      ),
    );

    if (!targetExercise) {
      return;
    }

    const alreadyExists = draftExercises.some((draftExercise) => {
      return (
        draftExercise.id !== targetExercise.id &&
        draftExercise.matchStatus === "matched" &&
        draftExercise.exerciseId === exercise.id
      );
    });

    if (alreadyExists) {
      setDuplicateNotice("这个动作已经在本次训练中。");
      return;
    }

    setDuplicateNotice(null);
    setDraftExercises((currentValue) =>
      currentValue.map((draftExercise) => {
        if (draftExercise.id !== targetExercise.id) {
          return draftExercise;
        }

        return {
          ...draftExercise,
          categoryLabel: getDisplayExerciseCategoryLabel(exercise),
          exercise,
          exerciseId: exercise.id,
          loadType: getExerciseLoadType(exercise),
          matchStatus: "matched",
          name: getExerciseDisplayName(exercise),
        };
      }),
    );
  }

  function resetComposerState(): void {
    setDraftExercises([]);
    setAppendNotice(null);
    setIsVoiceSheetOpen(false);
    setDuplicateNotice(null);
    setDraftDurationMin(null);
    setDraftEndedAt(null);
    setDraftNote("");
    setDraftPerformedAt(null);
    setDraftStartedAt(null);
    setElapsedSeconds(0);
    setErrorMessage(null);
    setHistoryExercise(null);
    setIsLibraryOpen(false);
    setIsMinimized(false);
    setIsNotesOpen(false);
    setIsSaved(false);
    setIsRunning(false);
    setIsTimeEditorOpen(false);
    setLeavingExerciseIds([]);
    setMoreMenuAnchor(null);
    setPendingExerciseRemovalId(null);
    setPendingRestTimerRequest(null);
    setPendingScrollExerciseId(null);
    setReplacingDraftExerciseId(null);
    setRestTimer(null);
  }
}

function TrainingTimeEditor(props: {
  endedAt: string | null;
  onClose: () => void;
  onSave: (value: {
    durationMin: number | null;
    endedAt: string | null;
    startedAt: string | null;
  }) => void;
  open: boolean;
  performedAt: string | null;
  startedAt: string | null;
}) {
  const { theme } = useTheme();
  const [startValue, setStartValue] = useState(
    formatDateTimeLocalValue(props.startedAt ?? props.performedAt),
  );
  const [endValue, setEndValue] = useState(
    formatDateTimeLocalValue(props.endedAt),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(props.open);
  const durationMin = getDurationMinutesFromLocalValues(startValue, endValue);

  // Each visit starts from the draft's current times.
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) {
      setStartValue(
        formatDateTimeLocalValue(props.startedAt ?? props.performedAt),
      );
      setEndValue(formatDateTimeLocalValue(props.endedAt));
      setErrorMessage(null);
    }
  }

  return (
    <ActionSheet
      description={formatTrainingTimeSummary({
        durationMin,
        endedAt: parseDateTimeLocalValue(endValue),
        performedAt: props.performedAt,
        startedAt: parseDateTimeLocalValue(startValue),
      })}
      footer={
        <div style={confirmActionRowStyle}>
          <Button onClick={props.onClose} type="button" variant="secondary">
            取消
          </Button>
          <Button onClick={handleSave} type="button">
            保存时间
          </Button>
        </div>
      }
      onClose={props.onClose}
      open={props.open}
      title="训练时间"
    >
      <label style={timeEditorLabelStyle(theme)}>
        开始时间
        <input
          onChange={(event) => {
            setStartValue(event.target.value);
            setErrorMessage(null);
          }}
          style={timeEditorInputStyle(theme)}
          type="datetime-local"
          value={startValue}
        />
      </label>

      <label style={timeEditorLabelStyle(theme)}>
        结束时间
        <input
          onChange={(event) => {
            setEndValue(event.target.value);
            setErrorMessage(null);
          }}
          style={timeEditorInputStyle(theme)}
          type="datetime-local"
          value={endValue}
        />
      </label>

      <p style={timeEditorSummaryStyle(theme)}>
        {durationMin === null
          ? "训练时长：未设置"
          : `训练时长：${durationMin} 分钟`}
      </p>

      {errorMessage ? (
        <p style={timeEditorErrorStyle(theme)}>{errorMessage}</p>
      ) : null}
    </ActionSheet>
  );

  function handleSave(): void {
    if (!startValue && !endValue) {
      props.onSave({
        durationMin: null,
        endedAt: null,
        startedAt: null,
      });
      return;
    }

    if (!startValue || !endValue) {
      setErrorMessage("请同时填写开始和结束时间。");
      return;
    }

    const startedAt = parseDateTimeLocalValue(startValue);
    const endedAt = parseDateTimeLocalValue(endValue);

    if (!startedAt || !endedAt) {
      setErrorMessage("请填写有效的训练时间。");
      return;
    }

    const startedAtMs = new Date(startedAt).getTime();
    const endedAtMs = new Date(endedAt).getTime();

    if (startedAtMs >= endedAtMs) {
      setErrorMessage("结束时间必须晚于开始时间。");
      return;
    }

    props.onSave({
      durationMin: Math.max(1, Math.round((endedAtMs - startedAtMs) / 60000)),
      endedAt,
      startedAt,
    });
  }
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Workout creation is unavailable right now.";
}

function translateErrorMessage(message: string): string {
  if (message === "You must be signed in to create a workout.") {
    return "请先登录后再创建训练。";
  }

  if (message === "Please fix the highlighted workout fields and try again.") {
    return "请先完成至少一组有效训练数据后再保存。";
  }

  if (message === "Workout creation is unavailable right now.") {
    return "训练保存暂时不可用，请稍后重试。";
  }

  return message;
}

const bodyStyle: React.CSSProperties = {
  minHeight: "100%",
  padding: "14px 12px 24px",
};

function notePreviewStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "grid",
    gap: 6,
    padding: "14px 16px",
    textAlign: "left",
    width: "100%",
  };
}

function notePreviewHeadStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx2,
    display: "flex",
    fontSize: 12,
    fontWeight: 700,
    gap: 6,
  };
}

function notePreviewTextStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    display: "-webkit-box",
    fontSize: 14,
    lineHeight: 1.6,
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 3,
    whiteSpace: "pre-wrap",
  };
}

function timeEditorLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    fontWeight: 700,
    gap: 8,
  };
}

function timeEditorInputStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    padding: "10px 12px",
  };
}

function timeEditorSummaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "4px 0 0",
  };
}

function timeEditorErrorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.red,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
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
