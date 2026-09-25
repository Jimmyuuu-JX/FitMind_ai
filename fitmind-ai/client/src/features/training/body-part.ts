import type { Theme } from "../../theme/tokens";

/**
 * Coarse body parts used to group the fine-grained muscle dictionary.
 *
 * The dictionary has 17 muscle groups (三角肌前束, 背阔肌 …). Charts that show
 * one tile or one color per group read better at this coarser level, which is
 * also how lifters talk about a session ("练胸", "练背").
 */
export const BODY_PARTS = [
  "胸",
  "背",
  "肩",
  "腿",
  "二头",
  "三头",
  "核心",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

const CODE_TO_PART: Record<string, BodyPart> = {
  back: "背",
  biceps: "二头",
  calves: "腿",
  chest: "胸",
  core: "核心",
  front_delts: "肩",
  glutes: "腿",
  hamstrings: "腿",
  lats: "背",
  legs: "腿",
  quads: "腿",
  rear_delts: "肩",
  shoulders: "肩",
  side_delts: "肩",
  triceps: "三头",
  upper_back: "背",
  upper_chest: "胸",
};

/**
 * Chinese-name rules, checked in order, for payloads that only carry the
 * muscle group's display name (the muscle-load endpoint).
 */
const NAME_RULES: ReadonlyArray<[RegExp, BodyPart]> = [
  [/二头/u, "二头"],
  [/三头/u, "三头"],
  [/三角|肩/u, "肩"],
  [/胸/u, "胸"],
  [/背|斜方/u, "背"],
  [/腿|股|腘|臀|小腿/u, "腿"],
  [/核心|腹/u, "核心"],
];

/** Keywords users write in session notes, e.g. "胸肩训练 1" or "练背". */
const NOTE_RULES: ReadonlyArray<[RegExp, BodyPart]> = [
  [/胸/u, "胸"],
  [/背/u, "背"],
  [/腿|臀/u, "腿"],
  [/肩/u, "肩"],
  [/二头|手臂|臂/u, "二头"],
  [/三头/u, "三头"],
  [/核心|腹/u, "核心"],
];

/**
 * Tie-break order when a session touches several parts equally: larger,
 * compound-driven parts name the day before the accessories that ride along.
 */
const DOMINANCE_ORDER: BodyPart[] = [
  "腿",
  "背",
  "胸",
  "肩",
  "二头",
  "三头",
  "核心",
];

export function getBodyPartForMuscleCode(code: string): BodyPart | null {
  return CODE_TO_PART[code.trim().toLowerCase()] ?? null;
}

export function getBodyPartForMuscleName(name: string): BodyPart | null {
  for (const [pattern, part] of NAME_RULES) {
    if (pattern.test(name)) {
      return part;
    }
  }

  return null;
}

/**
 * Picks the one body part a session is "about", for coloring its calendar tag.
 *
 * The user's own note wins when it names a part, because the list endpoint's
 * `muscle_groups` includes every secondary muscle and cannot tell a chest day
 * that also hits triceps from an arm day. Otherwise the part with the most
 * distinct muscle codes wins, ties broken by {@link DOMINANCE_ORDER}.
 *
 * @param workout - Session note and the muscle codes its sets touch
 * @returns The dominant part, or null when nothing maps
 */
export function getWorkoutBodyPart(workout: {
  muscle_groups: string[];
  notes: string | null;
}): BodyPart | null {
  const note = workout.notes?.trim() ?? "";

  if (note) {
    let firstMatch: { index: number; part: BodyPart } | null = null;

    for (const [pattern, part] of NOTE_RULES) {
      const index = note.search(pattern);

      if (index >= 0 && (firstMatch === null || index < firstMatch.index)) {
        firstMatch = { index, part };
      }
    }

    if (firstMatch) {
      return firstMatch.part;
    }
  }

  const counts = new Map<BodyPart, number>();

  for (const code of workout.muscle_groups) {
    const part = getBodyPartForMuscleCode(code);

    if (part) {
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }

  let best: BodyPart | null = null;

  for (const part of DOMINANCE_ORDER) {
    const count = counts.get(part) ?? 0;

    if (count > 0 && (best === null || count > (counts.get(best) ?? 0))) {
      best = part;
    }
  }

  return best;
}

/**
 * One stable color per body part, shared by the calendar tags and the charts
 * so a part keeps its color everywhere.
 */
export function getBodyPartColor(theme: Theme, part: BodyPart | null): string {
  switch (part) {
    case "胸":
      return theme.colors.pink;
    case "背":
      return theme.colors.purple;
    case "肩":
      return theme.colors.blue;
    case "腿":
      return theme.colors.orange;
    case "二头":
      return theme.colors.green;
    case "三头":
      return theme.colors.red;
    case "核心":
      return theme.colors.ac;
    default:
      return theme.colors.tx3;
  }
}
