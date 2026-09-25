import { describe, expect, it } from "vitest";

import type { DictionaryExercise } from "./dictionary-api";
import {
  buildLibrarySections,
  filterLibraryExercises,
  getEquipmentGroup,
  getExerciseLibraryPlacement,
  getPrimaryMuscleCode,
  listEquipmentGroups,
  listLibraryRail,
} from "./exercise-library-model";

function exercise(
  id: string,
  equipment: string | null,
  muscles: [code: string, isPrimary: boolean, weight?: number][],
  nameZh = id,
): DictionaryExercise {
  return {
    code: id,
    common_mistakes_zh: [],
    equipment,
    equipment_notes_zh: null,
    id,
    movement_pattern: null,
    muscles: muscles.map(([code, isPrimary, weight]) => ({
      code,
      contribution_weight: weight ?? (isPrimary ? 1 : 0.5),
      is_primary: isPrimary,
    })),
    name_en: id,
    name_zh: nameZh,
    technique_cues_zh: [],
  };
}

const bench = exercise(
  "bench",
  "barbell",
  [
    ["chest", true],
    ["triceps", false],
  ],
  "杠铃卧推",
);
const incline = exercise(
  "incline",
  "dumbbell",
  [["upper_chest", true]],
  "上斜哑铃卧推",
);
const fly = exercise("fly", "cable", [["chest", true]], "绳索夹胸");
const dip = exercise(
  "dip",
  "bodyweight",
  [
    ["triceps", true],
    ["chest", false],
  ],
  "双杠臂屈伸",
);
const pullUp = exercise("pullup", "bodyweight", [["lats", true]], "引体向上");
const row = exercise("row", "barbell", [["upper_back", true]], "杠铃划船");

describe("exercise library placement", () => {
  it("files an exercise under its primary muscle, not a secondary one", () => {
    expect(getExerciseLibraryPlacement(dip)).toEqual({
      muscleCode: "triceps",
      part: "手臂",
      sub: "三头",
    });
    expect(getExerciseLibraryPlacement(incline).sub).toBe("上胸");
    expect(getExerciseLibraryPlacement(bench).sub).toBe("中下胸");
  });

  it("picks the heaviest primary muscle and falls back to all muscles", () => {
    const deadlift = exercise("deadlift", "barbell", [
      ["hamstrings", true, 0.6],
      ["glutes", true, 1],
    ]);
    const unflagged = exercise("x", null, [
      ["core", false, 0.3],
      ["lats", false, 0.8],
    ]);

    expect(getPrimaryMuscleCode(deadlift)).toBe("glutes");
    expect(getPrimaryMuscleCode(unflagged)).toBe("lats");
    expect(getPrimaryMuscleCode(exercise("none", null, []))).toBeNull();
  });

  it("falls back to the coarse category for unknown muscle codes", () => {
    const shrug = exercise("shrug", "dumbbell", [["traps", true]]);

    expect(getExerciseLibraryPlacement(shrug)).toEqual({
      muscleCode: "traps",
      part: "背",
      sub: null,
    });
    expect(getExerciseLibraryPlacement(exercise("m", null, [])).part).toBe(
      "其他",
    );
  });
});

describe("exercise library rail", () => {
  it("counts parts, lists non-empty subs, and hides empty optional parts", () => {
    const rail = listLibraryRail([bench, incline, fly, dip, pullUp, row]);

    expect(rail.map((entry) => entry.part)).toEqual([
      "胸",
      "背",
      "腿",
      "肩",
      "手臂",
      "核心",
    ]);
    expect(rail[0]).toEqual({
      count: 3,
      part: "胸",
      subs: [
        { count: 1, label: "上胸" },
        { count: 2, label: "中下胸" },
      ],
    });
    expect(rail[2]).toEqual({ count: 0, part: "腿", subs: [] });
  });

  it("drops a lone sub-category that would just repeat its part", () => {
    const rail = listLibraryRail([dip]);

    expect(rail.find((entry) => entry.part === "手臂")).toEqual({
      count: 1,
      part: "手臂",
      subs: [],
    });
  });
});

describe("exercise library filtering and sections", () => {
  const all = [bench, incline, fly, dip, pullUp, row];

  it("filters by part and sub, and searches everything when a keyword is set", () => {
    expect(
      filterLibraryExercises(all, { keyword: "", part: "胸", sub: null }).map(
        (item) => item.id,
      ),
    ).toEqual(["bench", "incline", "fly"]);
    expect(
      filterLibraryExercises(all, { keyword: "", part: "胸", sub: "上胸" }).map(
        (item) => item.id,
      ),
    ).toEqual(["incline"]);
    expect(
      filterLibraryExercises(all, {
        keyword: "杠铃",
        part: "胸",
        sub: "上胸",
      }).map((item) => item.id),
    ).toEqual(["bench", "row"]);
  });

  it("maps equipment codes into ordered sections", () => {
    expect(getEquipmentGroup("none").key).toBe("bodyweight");
    expect(getEquipmentGroup("trx")).toMatchObject({
      key: "other",
      label: "其他",
    });
    expect(getEquipmentGroup(null).key).toBe("other");
    expect(listEquipmentGroups([dip, fly, bench]).map((g) => g.label)).toEqual([
      "杠铃",
      "绳索",
      "自重",
    ]);
  });

  it("groups by equipment without inventing a 常用 section", () => {
    const sections = buildLibrarySections(all);

    expect(sections.map((section) => section.label)).toEqual([
      "杠铃",
      "哑铃",
      "绳索",
      "自重",
    ]);
    expect(sections[0]?.exercises.map((item) => item.id)).toEqual([
      "bench",
      "row",
    ]);
  });

  it("orders by usage and leads with 常用 when counts are provided", () => {
    const usageCounts = new Map([
      ["row", 12],
      ["pullup", 30],
    ]);
    const sections = buildLibrarySections(all, { usageCounts });

    expect(sections[0]).toMatchObject({ key: "frequent", label: "常用" });
    expect(sections[0]?.exercises.map((item) => item.id)).toEqual([
      "pullup",
      "row",
    ]);
    expect(sections[1]?.exercises.map((item) => item.id)).toEqual([
      "row",
      "bench",
    ]);
  });

  it("applies the equipment filter and skips 常用 while filtering", () => {
    const sections = buildLibrarySections(all, {
      equipment: "bodyweight",
      usageCounts: new Map([["pullup", 3]]),
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.exercises.map((item) => item.id)).toEqual([
      "pullup",
      "dip",
    ]);
  });
});
