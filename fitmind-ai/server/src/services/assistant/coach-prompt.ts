import type { ToolChatToolSpec } from "../ai/openai-compatible-tool-chat.js";

const DATE_RANGE_PROPERTIES = {
  start_date: { type: "string", description: "开始日期，YYYY-MM-DD，含当天" },
  end_date: { type: "string", description: "结束日期，YYYY-MM-DD，含当天" },
} as const;

/** Tools the coach model can call. Names match the tool executor registry. */
export const COACH_TOOL_SPECS: ToolChatToolSpec[] = [
  {
    name: "find_exercises",
    description:
      "把动作名称（如「卧推」「划船」）解析成动作 ID。结果按用户近期是否练过排序；调用动作相关工具前先用它拿 ID。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "用户说的动作名称" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_training_summary",
    description:
      "日期范围内的训练汇总：训练次数、组数、次数、总训练量，以及每个动作的组数、训练量、最大重量和估算 1RM。",
    parameters: {
      type: "object",
      properties: DATE_RANGE_PROPERTIES,
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
  },
  {
    name: "get_exercise_progress",
    description:
      "单个动作在日期范围内的进展：每次训练的最大重量、估算 1RM 和变化趋势。",
    parameters: {
      type: "object",
      properties: {
        exercise_id: {
          type: "string",
          description: "find_exercises 返回的动作 ID",
        },
        ...DATE_RANGE_PROPERTIES,
      },
      required: ["exercise_id", "start_date", "end_date"],
      additionalProperties: false,
    },
  },
  {
    name: "get_muscle_load",
    description:
      "日期范围内各肌群的训练负荷（按动作对肌群的贡献比例分摊），以及负荷最低的肌群。判断偏科、哪里练得少时用它。",
    parameters: {
      type: "object",
      properties: DATE_RANGE_PROPERTIES,
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
  },
  {
    name: "get_weekly_training_report",
    description:
      "日期范围内的教练式周报：训练概况、亮点、需要注意的地方；可指定一个动作。",
    parameters: {
      type: "object",
      properties: {
        ...DATE_RANGE_PROPERTIES,
        exercise_id: {
          type: "string",
          description: "可选，find_exercises 返回的动作 ID",
        },
      },
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
  },
  {
    name: "get_recommendation_context",
    description:
      "日期范围内与今天练什么、是否需要休息相关的训练背景：最近训练的部位与时间、训练集中度。",
    parameters: {
      type: "object",
      properties: DATE_RANGE_PROPERTIES,
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
  },
  {
    name: "search_training_knowledge",
    description: "检索训练知识库，用于动作技术、常见错误、训练方法类问题。",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "要检索的问题" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

/**
 * Builds the coach system prompt for one turn.
 *
 * @param input - Today's date and time zone of the user.
 * @returns The system prompt.
 */
export function buildCoachSystemPrompt(input: {
  today: string;
  timeZone: string;
}): string {
  return `你是 FitMind 的力量训练教练，只根据用户自己的训练记录和训练知识库回答。

今天是 ${input.today}（时区 ${input.timeZone}）。用户没说时间范围时，默认看最近 30 天（含今天）；「最近 7 天」指今天和之前 6 天；「这个月」「上周」等按日历换算成具体日期。

规则：
1. 任何关于用户训练的数字都必须来自本轮或上文的工具结果，不要自己计算、估算或编造；工具没给的数字不要说。建议里也不要给出新的数字（例如目标重量、组数方案），用「小幅加重」「加一档」「减量一周」这类说法。
2. 提到具体动作时，先用 find_exercises 拿到动作 ID。「卧推」「深蹲」这类常用泛称，直接选名称最贴切、用户近期练得最多的那个（例如「卧推」默认指杠铃卧推），并在回答里说明按哪个动作分析；只有用户说的名称确实可能指好几个都常练的动作、且无法从上文判断时，才简短地问用户指哪一个。
3. 一个问题需要多方面数据时，分别调用对应工具；通常 1–3 次工具调用就够，不要重复查询同样的内容。
4. 结合前面的对话理解追问，例如「那划船呢」「它的最大重量是多少」指的是上文提到的分析方式或动作。
5. 涉及疼痛、伤病、用药或身体不适时，不给训练或治疗建议，提醒用户先停止训练并就医。
6. 与训练无关的话题（天气、闲聊、写作等）用一两句话说明你只负责训练相关的问题，不要回答内容，也不要举带数字的例子。
7. 用中文回答，简洁具体。第一行用一句话给结论；之后用 2–4 条以「- 」开头的要点给出依据（引用工具里的数字）；如有可执行的建议，最后一行以「建议：」开头。不要用标题和表格。`;
}
