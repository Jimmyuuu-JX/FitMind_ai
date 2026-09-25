import type { DictionaryExercise } from "./dictionary-api";
import { getExerciseCategory, getExerciseSearchText } from "./exercise-display";

/**
 * Body-part rail of the exercise library, top to bottom.
 *
 * The first six are always listed so the rail keeps a stable shape; the rest
 * only appear when the dictionary actually has exercises for them.
 */
export const LIBRARY_PARTS = [
  "胸",
  "背",
  "腿",
  "肩",
  "手臂",
  "核心",
  "有氧",
  "全身",
  "其他",
] as const;

export type LibraryPart = (typeof LIBRARY_PARTS)[number];

const ALWAYS_LISTED_PARTS: ReadonlySet<LibraryPart> = new Set([
  "胸",
  "背",
  "腿",
  "肩",
  "手臂",
  "核心",
]);

/** Sub-categories per part, in rail order. */
const PART_SUBS: Record<LibraryPart, readonly string[]> = {
  胸: ["上胸", "中下胸"],
  背: ["背阔肌", "上背"],
  腿: ["股四头", "腘绳肌", "臀部", "小腿"],
  肩: ["前束", "中束", "后束"],
  手臂: ["二头", "三头", "前臂"],
  核心: [],
  有氧: [],
  全身: [],
  其他: [],
};

/** Muscle code → rail placement; `sub` null means "the part as a whole". */
const MUSCLE_PLACEMENT: Record<
  string,
  { part: LibraryPart; sub: string | null }
> = {
  back: { part: "背", sub: null },
  biceps: { part: "手臂", sub: "二头" },
  calves: { part: "腿", sub: "小腿" },
  chest: { part: "胸", sub: "中下胸" },
  core: { part: "核心", sub: null },
  forearms: { part: "手臂", sub: "前臂" },
  front_delts: { part: "肩", sub: "前束" },
  glutes: { part: "腿", sub: "臀部" },
  hamstrings: { part: "腿", sub: "腘绳肌" },
  lats: { part: "背", sub: "背阔肌" },
  legs: { part: "腿", sub: null },
  quads: { part: "腿", sub: "股四头" },
  rear_delts: { part: "肩", sub: "后束" },
  shoulders: { part: "肩", sub: null },
  side_delts: { part: "肩", sub: "中束" },
  triceps: { part: "手臂", sub: "三头" },
  upper_back: { part: "背", sub: "上背" },
  upper_chest: { part: "胸", sub: "上胸" },
};

export interface LibraryPlacement {
  part: LibraryPart;
  sub: string | null;
  /** The muscle the placement was derived from, when there is one. */
  muscleCode: string | null;
}

/**
 * The muscle an exercise is "about": the heaviest primary muscle, or the
 * heaviest muscle overall when none is flagged primary.
 *
 * @param exercise - Dictionary exercise
 * @returns Lower-cased muscle code, or null when the exercise lists none
 */
export function getPrimaryMuscleCode(
  exercise: DictionaryExercise,
): string | null {
  const primary = exercise.muscles.filter((muscle) => muscle.is_primary);
  const pool = primary.length > 0 ? primary : exercise.muscles;
  let best: (typeof pool)[number] | null = null;

  for (const muscle of pool) {
    if (
      best === null ||
      muscle.contribution_weight > best.contribution_weight
    ) {
      best = muscle;
    }
  }

  return best ? best.code.trim().toLowerCase() : null;
}

/**
 * Where an exercise sits in the library rail.
 *
 * Placement follows the primary muscle, so a dip (triceps primary, chest
 * secondary) files under 手臂/三头 rather than wherever a secondary muscle
 * happens to point. Codes outside the known table fall back to the coarse
 * {@link getExerciseCategory} bucket without a sub-category.
 *
 * @param exercise - Dictionary exercise
 * @returns Part, optional sub-category, and the deciding muscle code
 */
export function getExerciseLibraryPlacement(
  exercise: DictionaryExercise,
): LibraryPlacement {
  const muscleCode = getPrimaryMuscleCode(exercise);
  const known = muscleCode ? MUSCLE_PLACEMENT[muscleCode] : undefined;

  if (known) {
    return { ...known, muscleCode };
  }

  const category = getExerciseCategory(exercise);
  const part: LibraryPart = category === "全部" ? "其他" : category;

  return { muscleCode, part, sub: null };
}

export interface EquipmentGroup {
  key: string;
  label: string;
  /** One character for the quick-index strip. */
  indexLabel: string;
}

const EQUIPMENT_GROUPS: readonly (EquipmentGroup & { codes: string[] })[] = [
  { codes: ["barbell"], indexLabel: "杠", key: "barbell", label: "杠铃" },
  { codes: ["dumbbell"], indexLabel: "哑", key: "dumbbell", label: "哑铃" },
  { codes: ["kettlebell"], indexLabel: "壶", key: "kettlebell", label: "壶铃" },
  { codes: ["cable"], indexLabel: "绳", key: "cable", label: "绳索" },
  { codes: ["machine"], indexLabel: "器", key: "machine", label: "器械" },
  { codes: ["plate"], indexLabel: "片", key: "plate", label: "杠铃片" },
  {
    codes: ["resistance_band"],
    indexLabel: "带",
    key: "resistance_band",
    label: "弹力带",
  },
  {
    codes: ["bodyweight", "none"],
    indexLabel: "自",
    key: "bodyweight",
    label: "自重",
  },
  { codes: ["sled"], indexLabel: "橇", key: "sled", label: "雪橇" },
];

const OTHER_EQUIPMENT_GROUP: EquipmentGroup = {
  indexLabel: "其",
  key: "other",
  label: "其他",
};

/** Section of the exercises the user trains most, shown first when known. */
export const FREQUENT_SECTION: EquipmentGroup = {
  indexLabel: "常",
  key: "frequent",
  label: "常用",
};

const FREQUENT_SECTION_LIMIT = 6;

/**
 * Equipment section an exercise belongs to.
 *
 * @param equipment - Raw equipment code from the dictionary
 * @returns Section key, heading and quick-index character
 */
export function getEquipmentGroup(
  equipment: string | null | undefined,
): EquipmentGroup {
  const code = equipment?.trim().toLowerCase() ?? "";
  const group = EQUIPMENT_GROUPS.find((item) => item.codes.includes(code));

  if (!group) {
    return OTHER_EQUIPMENT_GROUP;
  }

  return { indexLabel: group.indexLabel, key: group.key, label: group.label };
}

function equipmentOrder(key: string): number {
  const index = EQUIPMENT_GROUPS.findIndex((item) => item.key === key);

  return index === -1 ? EQUIPMENT_GROUPS.length : index;
}

export interface LibraryRailEntry {
  part: LibraryPart;
  count: number;
  /** Sub-categories that have exercises; empty when splitting adds nothing. */
  subs: { label: string; count: number }[];
}

/**
 * Rail entries with counts, hiding optional parts that have no exercises.
 *
 * @param exercises - Full dictionary list
 * @returns Parts in rail order with their non-empty sub-categories
 */
export function listLibraryRail(
  exercises: readonly DictionaryExercise[],
): LibraryRailEntry[] {
  const partCounts = new Map<LibraryPart, number>();
  const subCounts = new Map<string, number>();

  for (const exercise of exercises) {
    const placement = getExerciseLibraryPlacement(exercise);
    partCounts.set(placement.part, (partCounts.get(placement.part) ?? 0) + 1);

    if (placement.sub) {
      const key = `${placement.part}/${placement.sub}`;
      subCounts.set(key, (subCounts.get(key) ?? 0) + 1);
    }
  }

  return LIBRARY_PARTS.flatMap((part) => {
    const count = partCounts.get(part) ?? 0;

    if (count === 0 && !ALWAYS_LISTED_PARTS.has(part)) {
      return [];
    }

    const subs = PART_SUBS[part]
      .map((label) => ({
        count: subCounts.get(`${part}/${label}`) ?? 0,
        label,
      }))
      .filter((sub) => sub.count > 0);

    // One sub-category holding every exercise is the part itself again.
    const isRedundant = subs.length === 1 && subs[0]?.count === count;

    return [{ count, part, subs: isRedundant ? [] : subs }];
  });
}

export interface LibraryScope {
  part: LibraryPart;
  sub: string | null;
  keyword: string;
}

/**
 * Exercises visible for the current rail selection or search.
 *
 * A non-empty keyword searches the whole dictionary, ignoring the rail, so a
 * lifter who types a name never has to guess its body part first.
 *
 * @param exercises - Full dictionary list
 * @param scope - Rail part/sub and search keyword
 * @returns Matching exercises in their original order
 */
export function filterLibraryExercises(
  exercises: readonly DictionaryExercise[],
  scope: LibraryScope,
): DictionaryExercise[] {
  const keyword = scope.keyword.trim().toLowerCase();

  if (keyword) {
    return exercises.filter((exercise) =>
      getExerciseSearchText(exercise).includes(keyword),
    );
  }

  return exercises.filter((exercise) => {
    const placement = getExerciseLibraryPlacement(exercise);

    return (
      placement.part === scope.part &&
      (scope.sub === null || placement.sub === scope.sub)
    );
  });
}

/**
 * Equipment groups present in a list, for the filter chips.
 *
 * @param exercises - Exercises currently in scope
 * @returns Distinct groups in canonical equipment order
 */
export function listEquipmentGroups(
  exercises: readonly DictionaryExercise[],
): EquipmentGroup[] {
  const groups = new Map<string, EquipmentGroup>();

  for (const exercise of exercises) {
    const group = getEquipmentGroup(exercise.equipment);
    groups.set(group.key, group);
  }

  return [...groups.values()].sort(
    (left, right) => equipmentOrder(left.key) - equipmentOrder(right.key),
  );
}

export interface LibrarySection extends EquipmentGroup {
  exercises: DictionaryExercise[];
}

/**
 * Groups in-scope exercises into equipment sections.
 *
 * With usage counts, each section lists the most-used first and a 常用
 * section leads with the top few overall; without them, dictionary order is
 * kept and no 常用 section is invented.
 *
 * @param exercises - Exercises in scope
 * @param options - Optional equipment filter and usage counts by exercise id
 * @returns Non-empty sections in display order
 */
export function buildLibrarySections(
  exercises: readonly DictionaryExercise[],
  options: {
    equipment?: string | null | undefined;
    usageCounts?: ReadonlyMap<string, number> | undefined;
  } = {},
): LibrarySection[] {
  const usage = options.usageCounts;
  const countOf = (exercise: DictionaryExercise) =>
    usage?.get(exercise.id) ?? 0;
  const byUsage = (left: DictionaryExercise, right: DictionaryExercise) =>
    countOf(right) - countOf(left);
  const sections = new Map<string, LibrarySection>();

  for (const exercise of exercises) {
    const group = getEquipmentGroup(exercise.equipment);

    if (options.equipment && group.key !== options.equipment) {
      continue;
    }

    const section = sections.get(group.key) ?? { ...group, exercises: [] };
    section.exercises.push(exercise);
    sections.set(group.key, section);
  }

  const ordered = [...sections.values()]
    .sort((left, right) => equipmentOrder(left.key) - equipmentOrder(right.key))
    .map((section) => ({
      ...section,
      // Array.prototype.sort is stable, so ties keep dictionary order.
      exercises: usage
        ? [...section.exercises].sort(byUsage)
        : section.exercises,
    }));

  if (!usage || options.equipment) {
    return ordered;
  }

  const frequent = ordered
    .flatMap((section) => section.exercises)
    .filter((exercise) => countOf(exercise) > 0)
    .sort(byUsage)
    .slice(0, FREQUENT_SECTION_LIMIT);

  return frequent.length > 0
    ? [{ ...FREQUENT_SECTION, exercises: frequent }, ...ordered]
    : ordered;
}
