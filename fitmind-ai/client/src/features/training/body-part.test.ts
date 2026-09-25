import { describe, expect, it } from "vitest";

import {
  getBodyPartForMuscleCode,
  getBodyPartForMuscleName,
  getWorkoutBodyPart,
} from "./body-part";

describe("getBodyPartForMuscleCode", () => {
  it("maps every dictionary child group to its parent part", () => {
    expect(getBodyPartForMuscleCode("upper_chest")).toBe("胸");
    expect(getBodyPartForMuscleCode("lats")).toBe("背");
    expect(getBodyPartForMuscleCode("rear_delts")).toBe("肩");
    expect(getBodyPartForMuscleCode("glutes")).toBe("腿");
    expect(getBodyPartForMuscleCode("triceps")).toBe("三头");
  });

  it("returns null for unknown codes instead of guessing", () => {
    expect(getBodyPartForMuscleCode("forearms")).toBeNull();
  });
});

describe("getBodyPartForMuscleName", () => {
  it("keeps arm heads apart from the shoulder rule", () => {
    expect(getBodyPartForMuscleName("肱二头肌")).toBe("二头");
    expect(getBodyPartForMuscleName("肱三头肌")).toBe("三头");
    expect(getBodyPartForMuscleName("三角肌中束")).toBe("肩");
  });

  it("maps leg and back children", () => {
    expect(getBodyPartForMuscleName("腘绳肌")).toBe("腿");
    expect(getBodyPartForMuscleName("背阔肌")).toBe("背");
    expect(getBodyPartForMuscleName("上胸")).toBe("胸");
  });
});

describe("getWorkoutBodyPart", () => {
  it("prefers the first part the user's note names", () => {
    expect(
      getWorkoutBodyPart({
        muscle_groups: ["front_delts", "rear_delts", "side_delts"],
        notes: "胸肩训练 1",
      }),
    ).toBe("胸");
  });

  it("falls back to the part with the most distinct muscle codes", () => {
    expect(
      getWorkoutBodyPart({
        muscle_groups: ["biceps", "lats", "rear_delts", "upper_back"],
        notes: null,
      }),
    ).toBe("背");
  });

  it("breaks ties toward the larger part", () => {
    expect(
      getWorkoutBodyPart({ muscle_groups: ["chest", "quads"], notes: "  " }),
    ).toBe("腿");
  });

  it("returns null when nothing maps", () => {
    expect(getWorkoutBodyPart({ muscle_groups: [], notes: "拉伸" })).toBeNull();
  });
});
