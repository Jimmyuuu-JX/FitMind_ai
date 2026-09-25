import {
  isDraftSetValid,
  type DraftExercise,
  type DraftSet,
} from "./training-session-draft";

/**
 * Done/total progress for one exercise card: the set dots, the "N 组" count
 * and the right-aligned done/total amount.
 *
 * A set counts as done only when it is completed and valid, the same rule the
 * save path uses, so the header never promises more than will be saved.
 */
export interface ExerciseProgress {
  /** Amount already done: volume in kg, or reps when the exercise has no load. */
  completedAmount: number;
  completedSets: number;
  /** True once the exercise has at least one set and every set is done. */
  isDone: boolean;
  /** Bodyweight-only work has no volume, so it is tracked in reps instead. */
  metric: "volume" | "reps";
  /** One flag per set, in order: true when that set is done. */
  setCompletion: boolean[];
  /** Amount planned across every valid set, done or not. */
  totalAmount: number;
  totalSets: number;
}

/** Session header progress: "done/total 组 · done/total 动作 · done/total 容量". */
export interface SessionProgress {
  completedExercises: number;
  completedSets: number;
  completedVolumeKg: number;
  totalExercises: number;
  totalSets: number;
  totalVolumeKg: number;
}

/**
 * Builds the progress shown on one exercise card.
 *
 * @param draftExercise - Exercise with its draft sets
 * @returns Per-set completion flags plus done/total set and amount counts
 */
export function getExerciseProgress(
  draftExercise: DraftExercise,
): ExerciseProgress {
  let completedSets = 0;
  let completedVolume = 0;
  let totalVolume = 0;
  let completedReps = 0;
  let totalReps = 0;
  const setCompletion = draftExercise.sets.map((setDraft) => {
    const isDone = isDraftSetDone(setDraft, draftExercise);

    if (isDraftSetValid(setDraft, draftExercise)) {
      const volume = getValidSetVolumeKg(setDraft);
      const reps = Number.parseInt(setDraft.reps, 10);
      totalVolume += volume;
      totalReps += reps;

      if (isDone) {
        completedVolume += volume;
        completedReps += reps;
      }
    }

    if (isDone) {
      completedSets += 1;
    }

    return isDone;
  });
  const metric = totalVolume > 0 ? "volume" : "reps";

  return {
    completedAmount: metric === "volume" ? completedVolume : completedReps,
    completedSets,
    isDone:
      draftExercise.sets.length > 0 &&
      completedSets === draftExercise.sets.length,
    metric,
    setCompletion,
    totalAmount: metric === "volume" ? totalVolume : totalReps,
    totalSets: draftExercise.sets.length,
  };
}

/**
 * Aggregates the whole session for the editor header.
 *
 * @param draftExercises - Every exercise in the draft
 * @returns Done/total sets, exercises and volume
 */
export function getSessionProgress(
  draftExercises: DraftExercise[],
): SessionProgress {
  return draftExercises.reduce<SessionProgress>(
    (summary, draftExercise) => {
      const progress = getExerciseProgress(draftExercise);
      const volume = getExerciseVolume(draftExercise);

      return {
        completedExercises:
          summary.completedExercises + (progress.isDone ? 1 : 0),
        completedSets: summary.completedSets + progress.completedSets,
        completedVolumeKg: summary.completedVolumeKg + volume.completed,
        totalExercises: summary.totalExercises + 1,
        totalSets: summary.totalSets + progress.totalSets,
        totalVolumeKg: summary.totalVolumeKg + volume.total,
      };
    },
    {
      completedExercises: 0,
      completedSets: 0,
      completedVolumeKg: 0,
      totalExercises: 0,
      totalSets: 0,
      totalVolumeKg: 0,
    },
  );
}

/**
 * Formats a progress amount for display: whole numbers stay whole, anything
 * else keeps at most one decimal (7165.25 → "7165.3").
 *
 * @param value - Volume in kg or a rep count
 * @returns Display string
 */
export function formatProgressAmount(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return `${Math.round(value * 10) / 10}`;
}

/**
 * Formats seconds as HH:MM:SS.
 *
 * @param elapsedSeconds - Whole seconds
 * @returns Clock string
 */
export function formatElapsedTime(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => `${value}`.padStart(2, "0"))
    .join(":");
}

function isDraftSetDone(
  setDraft: DraftSet,
  draftExercise: DraftExercise,
): boolean {
  return setDraft.completed && isDraftSetValid(setDraft, draftExercise);
}

function getExerciseVolume(draftExercise: DraftExercise): {
  completed: number;
  total: number;
} {
  return draftExercise.sets.reduce(
    (volume, setDraft) => {
      if (!isDraftSetValid(setDraft, draftExercise)) {
        return volume;
      }

      const setVolume = getValidSetVolumeKg(setDraft);

      return {
        completed: volume.completed + (setDraft.completed ? setVolume : 0),
        total: volume.total + setVolume,
      };
    },
    { completed: 0, total: 0 },
  );
}

/**
 * Volume of a set already known to be valid. A valid set with a blank weight
 * can only be bodyweight work, which carries no external load.
 */
function getValidSetVolumeKg(setDraft: DraftSet): number {
  const weightKg =
    setDraft.weightKg.trim() === "" ? 0 : Number.parseFloat(setDraft.weightKg);

  return weightKg * Number.parseInt(setDraft.reps, 10);
}
