import { describe, expect, it } from "vitest";

import type {
  WorkoutDetailDto,
  WorkoutSetDto,
} from "../../../../shared/src/training";

import {
  formatDurationZh,
  formatKg,
  getWorkoutMinutes,
  groupWorkoutSets,
} from "./workout-detail-model";

describe("groupWorkoutSets", () => {
  it("keeps first-appearance order, sorts sets and sums volume", () => {
    const groups = groupWorkoutSets(
      [
        set({
          exercise_id: "row",
          id: "a",
          reps: 8,
          set_index: 2,
          weight_kg: 90,
        }),
        set({
          exercise_id: "pull",
          id: "b",
          reps: 10,
          set_index: 1,
          weight_kg: 0,
        }),
        set({
          exercise_id: "row",
          id: "c",
          reps: 9,
          set_index: 1,
          weight_kg: 87.5,
        }),
      ],
      new Map([["row", "器械划船"]]),
    );

    expect(groups.map((g) => g.exerciseName)).toEqual(["器械划船", "未知动作"]);
    expect(groups[0]?.sets.map((s) => s.id)).toEqual(["c", "a"]);
    expect(groups[0]?.totalVolume).toBe(87.5 * 9 + 90 * 8);
  });
});

describe("getWorkoutMinutes", () => {
  it("prefers the recorded start/end span", () => {
    expect(
      getWorkoutMinutes(
        detail({
          duration_minutes: 30,
          ended_at: "2026-09-23T13:05:00.000Z",
          started_at: "2026-09-23T11:53:00.000Z",
        }),
      ),
    ).toBe(72);
  });

  it("falls back to the stored duration", () => {
    expect(getWorkoutMinutes(detail({ duration_minutes: 45 }))).toBe(45);
    expect(getWorkoutMinutes(detail({}))).toBeNull();
  });
});

describe("formatters", () => {
  it("formats durations in Chinese", () => {
    expect(formatDurationZh(71)).toBe("1小时11分钟");
    expect(formatDurationZh(45)).toBe("45分钟");
    expect(formatDurationZh(120)).toBe("2小时");
  });

  it("formats kilograms without trailing zeros", () => {
    expect(formatKg(87.5)).toBe("87.5");
    expect(formatKg(90)).toBe("90");
    expect(formatKg(43.75)).toBe("43.75");
  });
});

function set(overrides: Partial<WorkoutSetDto>): WorkoutSetDto {
  return {
    created_at: "2026-09-23T12:00:00.000Z",
    exercise_id: "x",
    id: "id",
    is_warmup: false,
    notes: null,
    reps: 1,
    rpe: null,
    set_index: 1,
    weight_kg: 0,
    ...overrides,
  };
}

function detail(overrides: Partial<WorkoutDetailDto>): WorkoutDetailDto {
  return {
    duration_minutes: null,
    ended_at: null,
    id: "w",
    notes: null,
    performed_at: "2026-09-23T11:53:00.000Z",
    sets: [],
    started_at: null,
    ...overrides,
  };
}
