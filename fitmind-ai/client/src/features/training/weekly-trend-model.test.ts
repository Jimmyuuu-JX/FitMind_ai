import { describe, expect, it } from "vitest";

import type { MuscleLoadGroup } from "./muscle-load-api";

import {
  averageCompletedWeeks,
  buildBodyPartShares,
  compareCompletedWeeks,
  emptyBodyPartValues,
  formatChangeRatio,
  formatCompactKg,
  sumPartVolumes,
  type WeeklyTrendPoint,
} from "./weekly-trend-model";

describe("sumPartVolumes", () => {
  it("adds child groups into their part and ignores unmapped ones", () => {
    const values = sumPartVolumes([
      group("背阔肌", 1000),
      group("上背", 600),
      group("肱二头肌", 200),
      group("前臂", 50),
    ]);

    expect(values.背).toBe(1600);
    expect(values.二头).toBe(200);
    expect(Object.values(values).reduce((a, b) => a + b, 0)).toBe(1800);
  });
});

describe("buildBodyPartShares", () => {
  it("orders parts by volume with shares of the mapped total", () => {
    const shares = buildBodyPartShares([
      group("胸", 300),
      group("背阔肌", 500),
      group("上背", 200),
      group("核心", 0),
    ]);

    expect(shares.map((share) => share.part)).toEqual(["背", "胸"]);
    expect(shares[0]?.ratio).toBeCloseTo(0.7);
    expect(shares[0]?.groups.map((g) => g.muscle_group_name)).toEqual([
      "背阔肌",
      "上背",
    ]);
  });
});

describe("completed-week metrics", () => {
  const points = [
    point({ totalVolume: 1000 }),
    point({ totalVolume: 3000 }),
    point({ totalVolume: 4500 }),
    point({ isCurrentWeek: true, totalVolume: 100 }),
  ];

  it("compares the last two completed weeks, not the running one", () => {
    expect(compareCompletedWeeks(points, (p) => p.totalVolume)).toEqual({
      current: 4500,
      previous: 3000,
      ratio: 0.5,
    });
  });

  it("averages completed weeks only", () => {
    expect(averageCompletedWeeks(points, (p) => p.totalVolume)).toBeCloseTo(
      2833.33,
      1,
    );
  });

  it("has no ratio against an empty week", () => {
    expect(
      compareCompletedWeeks(
        [point({ totalVolume: 0 }), point({ totalVolume: 10 })],
        (p) => p.totalVolume,
      )?.ratio,
    ).toBeNull();
  });
});

describe("formatters", () => {
  it("formats change ratios", () => {
    expect(formatChangeRatio(0.123)).toBe("+12%");
    expect(formatChangeRatio(-0.08)).toBe("-8%");
    expect(formatChangeRatio(0.001)).toBe("持平");
    expect(formatChangeRatio(null)).toBe("—");
  });

  it("formats compact kilograms", () => {
    expect(formatCompactKg(950)).toBe("950");
    expect(formatCompactKg(16945)).toBe("16.9k");
    expect(formatCompactKg(134000)).toBe("134k");
  });
});

function group(name: string, weightedVolume: number): MuscleLoadGroup {
  return {
    contribution_ratio: 0,
    muscle_group_id: name,
    muscle_group_name: name,
    raw_volume: weightedVolume,
    set_count: 1,
    top_exercises: [],
    total_reps: 1,
    weighted_volume: weightedVolume,
  };
}

function point(overrides: Partial<WeeklyTrendPoint>): WeeklyTrendPoint {
  return {
    isCurrentWeek: false,
    label: "09/01",
    partVolumes: emptyBodyPartValues(),
    range: { end_date: "2026-09-07", start_date: "2026-09-01" },
    setCount: 0,
    totalVolume: 0,
    workoutCount: 0,
    ...overrides,
  };
}
