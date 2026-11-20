import { describe, expect, it } from "vitest";

import {
  answerToHistoryText,
  buildCoachAnswer,
  coachIntentFor,
  compactToolOutputForModel,
  type CoachToolRun,
} from "./coach-answer.js";

const progressRun: CoachToolRun = {
  name: "get_exercise_progress",
  args: { exercise_id: "e1" },
  ok: true,
  output: {
    best_weight_kg: 77.5,
    evidence: {
      workout_ids: ["w1", "w2"],
      set_ids: ["s1"],
      calculation_rules: ["Epley 1RM"],
    },
  },
};

const knowledgeRun: CoachToolRun = {
  name: "search_training_knowledge",
  args: { query: "膝盖内扣" },
  ok: true,
  output: {
    query: "膝盖内扣",
    sources: [
      {
        id: "k1",
        title: "深蹲膝盖内扣",
        category: "technique",
        chunk_text: "……",
        source_type: "seed",
        tags: [],
      },
    ],
  },
};

describe("buildCoachAnswer", () => {
  it("splits the reply into summary, bullets and recommendation", () => {
    const answer = buildCoachAnswer(
      "## 卧推这四周没有再涨\n\n- 最大重量停在 **77.5kg**\n2. 每次都是 4 组 5 次\n建议：下周小幅加重",
      [progressRun],
    );

    expect(answer.summary).toBe("卧推这四周没有再涨");
    expect(answer.bullets).toEqual([
      "最大重量停在 77.5kg",
      "每次都是 4 组 5 次",
    ]);
    expect(answer.recommendation).toBe("下周小幅加重");
  });

  it("takes evidence and sources from tool results, not from the text", () => {
    const answer = buildCoachAnswer("结论", [
      progressRun,
      knowledgeRun,
      {
        name: "get_training_summary",
        args: {},
        ok: false,
        output: { error: "x" },
      },
    ]);

    expect(answer.evidence).toEqual({
      source: "deterministic_tool_executor",
      tool_names: ["get_exercise_progress", "search_training_knowledge"],
      workout_ids: ["w1", "w2"],
      set_ids: ["s1"],
      calculation_rules: ["Epley 1RM"],
    });
    expect(answer.sources.map((source) => source.id)).toEqual(["k1"]);
  });
});

describe("coachIntentFor", () => {
  it("labels the turn from the tools that succeeded", () => {
    expect(coachIntentFor([progressRun])).toBe("progress");
    expect(coachIntentFor([knowledgeRun])).toBe("knowledge");
    expect(coachIntentFor([progressRun, knowledgeRun])).toBe("mixed_tool_rag");
    expect(coachIntentFor([])).toBe("unsupported");
    expect(
      coachIntentFor([
        { name: "find_exercises", args: {}, ok: true, output: {} },
      ]),
    ).toBe("unsupported");
  });
});

describe("compactToolOutputForModel", () => {
  it("replaces id lists with counts and keeps everything else", () => {
    expect(JSON.parse(compactToolOutputForModel(progressRun.output))).toEqual({
      best_weight_kg: 77.5,
      evidence: {
        workout_ids: { count: 2 },
        set_ids: { count: 1 },
        calculation_rules: ["Epley 1RM"],
      },
    });
  });
});

describe("answerToHistoryText", () => {
  it("renders a stored answer as the text the model wrote", () => {
    const answer = buildCoachAnswer("结论\n- 依据\n建议：做法", []);

    expect(answerToHistoryText(answer)).toBe("结论\n- 依据\n建议：做法");
  });
});
