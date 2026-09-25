import { describe, expect, it } from "vitest";

import type { DraftExercise, DraftSet } from "./training-session-draft";
import {
  formatElapsedTime,
  formatProgressAmount,
  getExerciseProgress,
  getSessionProgress,
} from "./training-session-progress";

function createSet(overrides: Partial<DraftSet> = {}): DraftSet {
  return {
    completed: false,
    effort: "normal",
    id: "set-1",
    isWarmup: false,
    reps: "8",
    restSeconds: null,
    weightKg: "60",
    ...overrides,
  };
}

function createExercise(overrides: Partial<DraftExercise> = {}): DraftExercise {
  return {
    candidateExercises: [],
    categoryLabel: "胸",
    exercise: null,
    exerciseId: "bench-press",
    id: "exercise-1",
    inputName: null,
    isExpanded: false,
    loadType: "weighted",
    matchStatus: "matched",
    name: "杠铃卧推",
    sets: [],
    ...overrides,
  };
}

describe("getExerciseProgress", () => {
  it("counts only completed valid sets as done and plans every valid set", () => {
    const progress = getExerciseProgress(
      createExercise({
        sets: [
          createSet({ completed: true, id: "a" }),
          createSet({ id: "b", reps: "10", weightKg: "62.5" }),
          // Ticked but invalid (no reps): neither done nor planned volume.
          createSet({ completed: true, id: "c", reps: "" }),
        ],
      }),
    );

    expect(progress).toEqual({
      completedAmount: 480,
      completedSets: 1,
      isDone: false,
      metric: "volume",
      setCompletion: [true, false, false],
      totalAmount: 1105,
      totalSets: 3,
    });
  });

  it("tracks bodyweight work without load in reps", () => {
    const progress = getExerciseProgress(
      createExercise({
        loadType: "bodyweight",
        sets: [
          createSet({ completed: true, id: "a", reps: "12", weightKg: "" }),
          createSet({ completed: true, id: "b", reps: "10", weightKg: "" }),
        ],
      }),
    );

    expect(progress.metric).toBe("reps");
    expect(progress.completedAmount).toBe(22);
    expect(progress.totalAmount).toBe(22);
    expect(progress.isDone).toBe(true);
  });

  it("never treats an exercise without sets as done", () => {
    expect(getExerciseProgress(createExercise()).isDone).toBe(false);
  });
});

describe("getSessionProgress", () => {
  it("sums sets, finished exercises and volume across the session", () => {
    const progress = getSessionProgress([
      createExercise({
        id: "a",
        sets: [
          createSet({ completed: true, id: "a1" }),
          createSet({ completed: true, id: "a2" }),
        ],
      }),
      createExercise({
        id: "b",
        sets: [
          createSet({ completed: true, id: "b1", weightKg: "100" }),
          createSet({ id: "b2", weightKg: "100" }),
        ],
      }),
      createExercise({ id: "c" }),
    ]);

    expect(progress).toEqual({
      completedExercises: 1,
      completedSets: 3,
      completedVolumeKg: 1760,
      totalExercises: 3,
      totalSets: 4,
      totalVolumeKg: 2560,
    });
  });
});

describe("formatProgressAmount", () => {
  it("keeps whole numbers whole and rounds the rest to one decimal", () => {
    expect(formatProgressAmount(22002)).toBe("22002");
    expect(formatProgressAmount(2002.5)).toBe("2002.5");
    expect(formatProgressAmount(7165.25)).toBe("7165.3");
  });
});

describe("formatElapsedTime", () => {
  it("renders HH:MM:SS and clamps negatives", () => {
    expect(formatElapsedTime(4311)).toBe("01:11:51");
    expect(formatElapsedTime(59.9)).toBe("00:00:59");
    expect(formatElapsedTime(-5)).toBe("00:00:00");
  });
});
