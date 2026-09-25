import {
  createDraftSet as createDefaultDraftSet,
  type DraftExercise,
  type EffortLevel,
} from "./training-session-draft";
import type { DraftSetFactory } from "./training-session-set-state";

/**
 * Editor-level transitions layered on top of the five core set transitions in
 * `training-session-set-state.ts`: accordion expansion, the live-session
 * "complete then prefill the next set" flow, clearing a set, and recording a
 * rest period.
 */

const EFFORT_CYCLE: EffortLevel[] = ["easy", "normal", "hard"];

/**
 * Accordion toggle: opening one exercise closes every other one, tapping the
 * open exercise closes it.
 *
 * @param draftExercises - Current draft
 * @param exerciseId - Exercise whose card was tapped
 * @returns Next draft with at most one expanded exercise
 */
export function toggleExpandedExercise(
  draftExercises: DraftExercise[],
  exerciseId: string,
): DraftExercise[] {
  const target = draftExercises.find((item) => item.id === exerciseId);

  if (!target) {
    return draftExercises;
  }

  const nextExpanded = !target.isExpanded;

  return draftExercises.map((draftExercise) => {
    const isExpanded = draftExercise.id === exerciseId ? nextExpanded : false;

    return draftExercise.isExpanded === isExpanded
      ? draftExercise
      : { ...draftExercise, isExpanded };
  });
}

/**
 * After a set is ticked, prefills the next set with the same weight and reps
 * so the lifter rarely types (训记: 完成一组后智能添加下一组).
 *
 * Only fires when the set went from not completed to completed and it is the
 * exercise's last set; ticking an earlier set, un-ticking, or a tick rejected
 * as invalid leaves the draft unchanged. The new set is never completed, so it
 * is not saved unless the lifter ticks it too.
 *
 * @param previous - Draft before the completion toggle
 * @param next - Draft after `toggleDraftSetCompleted`
 * @param exerciseId - Exercise that owns the set
 * @param setId - Set that was toggled
 * @param createSet - Set factory (injectable for deterministic tests)
 * @returns `next`, with one prefilled set appended when the rule applies
 */
export function appendNextSetAfterCompletion(
  previous: DraftExercise[],
  next: DraftExercise[],
  exerciseId: string,
  setId: string,
  createSet: DraftSetFactory = createDefaultDraftSet,
): DraftExercise[] {
  const wasCompleted = previous
    .find((item) => item.id === exerciseId)
    ?.sets.find((setDraft) => setDraft.id === setId)?.completed;

  return next.map((draftExercise) => {
    if (draftExercise.id !== exerciseId) {
      return draftExercise;
    }

    const lastSet = draftExercise.sets.at(-1);

    if (
      wasCompleted !== false ||
      !lastSet ||
      lastSet.id !== setId ||
      !lastSet.completed
    ) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      sets: [
        ...draftExercise.sets,
        { ...createSet(lastSet), restSeconds: null },
      ],
    };
  });
}

/**
 * Empties a set's weight and reps (训记 set menu: 清空). The set drops back to
 * not completed because an empty set can no longer be valid.
 *
 * @param draftExercises - Current draft
 * @param exerciseId - Exercise that owns the set
 * @param setId - Set to clear
 * @returns Next draft
 */
export function clearDraftSetValues(
  draftExercises: DraftExercise[],
  exerciseId: string,
  setId: string,
): DraftExercise[] {
  return draftExercises.map((draftExercise) => {
    if (draftExercise.id !== exerciseId) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      sets: draftExercise.sets.map((setDraft) => {
        if (setDraft.id !== setId) {
          return setDraft;
        }

        return {
          ...setDraft,
          completed: false,
          reps: "",
          restSeconds: null,
          weightKg: "",
        };
      }),
    };
  });
}

/**
 * Records a rest period against a set and marks it completed, which is what
 * starting a rest countdown from a set means.
 *
 * @param draftExercises - Current draft
 * @param setId - Set the rest follows
 * @param restSeconds - Rest duration in seconds
 * @returns Next draft
 */
export function completeDraftSetWithRest(
  draftExercises: DraftExercise[],
  setId: string,
  restSeconds: number,
): DraftExercise[] {
  return draftExercises.map((draftExercise) => {
    if (!draftExercise.sets.some((setDraft) => setDraft.id === setId)) {
      return draftExercise;
    }

    return {
      ...draftExercise,
      sets: draftExercise.sets.map((setDraft) => {
        if (setDraft.id !== setId) {
          return setDraft;
        }

        return {
          ...setDraft,
          completed: true,
          restSeconds,
        };
      }),
    };
  });
}

/**
 * Next effort in the 简单 → 正常 → 困难 → 简单 cycle used by the set row's
 * effort chip.
 *
 * @param effort - Current effort
 * @returns Following effort
 */
export function cycleEffortLevel(effort: EffortLevel): EffortLevel {
  const index = EFFORT_CYCLE.indexOf(effort);

  return EFFORT_CYCLE[(index + 1) % EFFORT_CYCLE.length] ?? "normal";
}
