import { describe, expect, it, vi } from "vitest";

import type { DraftExercise, DraftSet } from "./training-session-draft";
import {
  appendNextSetAfterCompletion,
  clearDraftSetValues,
  completeDraftSetWithRest,
  cycleEffortLevel,
  toggleExpandedExercise,
} from "./training-session-set-actions";
import { toggleDraftSetCompleted } from "./training-session-set-state";

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
    sets: [createSet()],
    ...overrides,
  };
}

describe("toggleExpandedExercise", () => {
  it("expands the tapped exercise and collapses every other one", () => {
    const input = [
      createExercise({ id: "a", isExpanded: true }),
      createExercise({ id: "b" }),
      createExercise({ id: "c" }),
    ];
    const original = structuredClone(input);

    const next = toggleExpandedExercise(input, "b");

    expect(next.map((item) => item.isExpanded)).toEqual([false, true, false]);
    expect(next[2]).toBe(input[2]);
    expect(input).toEqual(original);
  });

  it("collapses the exercise when it is already open", () => {
    const input = [createExercise({ id: "a", isExpanded: true })];

    expect(toggleExpandedExercise(input, "a")[0]?.isExpanded).toBe(false);
  });

  it("returns the same draft for an unknown exercise", () => {
    const input = [createExercise({ id: "a", isExpanded: true })];

    expect(toggleExpandedExercise(input, "missing")).toBe(input);
  });
});

describe("appendNextSetAfterCompletion", () => {
  it("prefills the next set from the last set once it is ticked", () => {
    const lastSet = createSet({
      effort: "hard",
      id: "set-2",
      isWarmup: true,
      reps: "10",
      weightKg: "62.5",
    });
    const previous = [
      createExercise({ sets: [createSet({ completed: true }), lastSet] }),
      createExercise({ id: "exercise-2" }),
    ];
    const toggled = toggleDraftSetCompleted(previous, "exercise-1", "set-2");
    const setFactory = vi.fn((source?: DraftSet) => ({
      completed: false,
      effort: source?.effort ?? "normal",
      id: "set-generated",
      isWarmup: source?.isWarmup ?? false,
      reps: source?.reps ?? "",
      restSeconds: 90,
      weightKg: source?.weightKg ?? "",
    }));

    const next = appendNextSetAfterCompletion(
      previous,
      toggled,
      "exercise-1",
      "set-2",
      setFactory,
    );

    expect(setFactory).toHaveBeenCalledWith({ ...lastSet, completed: true });
    expect(next[0]?.sets).toHaveLength(3);
    expect(next[0]?.sets[2]).toEqual({
      completed: false,
      effort: "hard",
      id: "set-generated",
      isWarmup: true,
      reps: "10",
      restSeconds: null,
      weightKg: "62.5",
    });
    expect(next[1]).toBe(toggled[1]);
  });

  it("does nothing when an earlier set is ticked", () => {
    const previous = [
      createExercise({ sets: [createSet(), createSet({ id: "set-2" })] }),
    ];
    const toggled = toggleDraftSetCompleted(previous, "exercise-1", "set-1");

    expect(
      appendNextSetAfterCompletion(previous, toggled, "exercise-1", "set-1"),
    ).toEqual(toggled);
  });

  it("does nothing when the last set is un-ticked", () => {
    const previous = [
      createExercise({ sets: [createSet({ completed: true })] }),
    ];
    const toggled = toggleDraftSetCompleted(previous, "exercise-1", "set-1");

    expect(toggled[0]?.sets[0]?.completed).toBe(false);
    expect(
      appendNextSetAfterCompletion(previous, toggled, "exercise-1", "set-1"),
    ).toEqual(toggled);
  });

  it("does nothing when the tick was rejected as invalid", () => {
    const previous = [createExercise({ sets: [createSet({ reps: "" })] })];
    const toggled = toggleDraftSetCompleted(previous, "exercise-1", "set-1");

    expect(
      appendNextSetAfterCompletion(previous, toggled, "exercise-1", "set-1"),
    ).toEqual(toggled);
  });
});

describe("clearDraftSetValues", () => {
  it("empties weight and reps and drops completion for one set", () => {
    const input = [
      createExercise({
        sets: [
          createSet({ completed: true, restSeconds: 90 }),
          createSet({ completed: true, id: "set-2" }),
        ],
      }),
    ];
    const original = structuredClone(input);

    const next = clearDraftSetValues(input, "exercise-1", "set-1");

    expect(next[0]?.sets[0]).toEqual(
      createSet({
        completed: false,
        reps: "",
        restSeconds: null,
        weightKg: "",
      }),
    );
    expect(next[0]?.sets[1]).toBe(input[0]?.sets[1]);
    expect(input).toEqual(original);
  });
});

describe("completeDraftSetWithRest", () => {
  it("marks the set completed and records the rest period", () => {
    const input = [
      createExercise({ id: "a", sets: [createSet({ id: "x" })] }),
      createExercise({ id: "b", sets: [createSet({ id: "y" })] }),
    ];

    const next = completeDraftSetWithRest(input, "y", 120);

    expect(next[0]).toBe(input[0]);
    expect(next[1]?.sets[0]).toEqual(
      createSet({ completed: true, id: "y", restSeconds: 120 }),
    );
  });
});

describe("cycleEffortLevel", () => {
  it("cycles 简单 → 正常 → 困难 → 简单", () => {
    expect(cycleEffortLevel("easy")).toBe("normal");
    expect(cycleEffortLevel("normal")).toBe("hard");
    expect(cycleEffortLevel("hard")).toBe("easy");
  });
});
