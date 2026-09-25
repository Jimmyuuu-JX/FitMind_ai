import { useEffect, useMemo, useState } from "react";

import { Icon } from "../../components/Icon";
import { StateNotice } from "../../components/StateNotice";
import { MOTION } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { ExerciseLibraryScreen } from "./ExerciseLibraryScreen";
import { getBodyPartColor, type BodyPart } from "./body-part";
import {
  type DictionaryExercise,
  type DictionaryMuscleGroup,
} from "./dictionary-api";
import { listLibraryRail, type LibraryPart } from "./exercise-library-model";

export interface ExercisePickerProps {
  exercises: DictionaryExercise[];
  isLoadingExercises: boolean;
  isLoadingMuscleGroups: boolean;
  muscleGroups: DictionaryMuscleGroup[];
  onSearch: (input: { muscle: string; q: string }) => Promise<void>;
  onSelectExercise?: ((exercise: DictionaryExercise) => void) | undefined;
  searchError: string | null;
  token?: string | null | undefined;
  /**
   * How often the user has trained each exercise, keyed by exercise id. The
   * library shows "N 次" badges and a 常用 section only when this is given.
   */
  usageCounts?: ReadonlyMap<string, number> | undefined;
  /**
   * Open the full library as soon as the picker mounts (the training tab's
   * 展开). Defaults to true.
   */
  openLibraryOnMount?: boolean | undefined;
}

const PART_COLOR: Partial<Record<LibraryPart, BodyPart>> = {
  手臂: "二头",
  核心: "核心",
  肩: "肩",
  胸: "胸",
  背: "背",
  腿: "腿",
};

/**
 * Training-tab entry to the exercise library.
 *
 * Expanding the card slides the full library up in browse mode, where a tap
 * opens the exercise detail. Left behind in the card are a search entry and
 * body-part shortcuts that reopen the library at that part. When
 * `onSelectExercise` is given, the library picks on tap instead.
 *
 * @param props - Dictionary state and optional pick handler
 * @returns Inline shortcuts plus the library page
 */
export function ExercisePicker(props: ExercisePickerProps) {
  const { theme } = useTheme();
  const { exercises, isLoadingExercises, searchError } = props;
  const openOnMount = props.openLibraryOnMount ?? true;
  const [libraryPart, setLibraryPart] = useState<LibraryPart | null>(null);
  const [focusSearch, setFocusSearch] = useState(false);
  const rail = useMemo(() => listLibraryRail(exercises), [exercises]);

  useEffect(() => {
    if (!openOnMount) {
      return;
    }

    const frame = requestAnimationFrame(() => setLibraryPart("胸"));

    return () => cancelAnimationFrame(frame);
  }, [openOnMount]);

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <button
        onClick={() => {
          setFocusSearch(true);
          setLibraryPart(rail[0]?.part ?? "胸");
        }}
        style={searchEntryStyle(theme)}
        type="button"
      >
        <Icon name="search" size={15} />
        <span>输入动作名字搜索</span>
      </button>

      {searchError ? (
        <StateNotice
          description="动作库暂时无法加载，请确认服务已启动，或稍后重试。"
          icon="search"
          title="动作库加载失败"
          tone="error"
        />
      ) : null}

      {!searchError && isLoadingExercises && exercises.length === 0 ? (
        <p style={copyStyle(theme)}>正在加载动作库...</p>
      ) : null}

      {!searchError && exercises.length > 0 ? (
        <ul aria-label="按部位浏览" style={partGridStyle}>
          {rail
            .filter((entry) => entry.count > 0)
            .map((entry) => {
              const color = getBodyPartColor(
                theme,
                PART_COLOR[entry.part] ?? null,
              );

              return (
                <li key={entry.part} style={{ listStyle: "none" }}>
                  <button
                    onClick={() => {
                      setFocusSearch(false);
                      setLibraryPart(entry.part);
                    }}
                    style={partTileStyle(theme)}
                    type="button"
                  >
                    <span style={partNameRowStyle}>
                      <span aria-hidden="true" style={partDotStyle(color)} />
                      <strong style={{ fontSize: 13, fontWeight: 600 }}>
                        {entry.part}
                      </strong>
                    </span>
                    <span style={copyStyle(theme)}>{entry.count} 个动作</span>
                  </button>
                </li>
              );
            })}
        </ul>
      ) : null}

      {libraryPart !== null ? (
        <ExerciseLibraryScreen
          {...props}
          autoFocusSearch={focusSearch}
          initialPart={libraryPart}
          isOpen
          mode={props.onSelectExercise ? "add" : "browse"}
          onClose={() => setLibraryPart(null)}
          onSelectExercise={
            props.onSelectExercise
              ? (exercise) => {
                  props.onSelectExercise?.(exercise);
                  setLibraryPart(null);
                }
              : undefined
          }
        />
      ) : null}
    </section>
  );
}

function searchEntryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.soft,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.capsule,
    color: theme.colors.tx3,
    cursor: "pointer",
    display: "flex",
    fontSize: 13,
    gap: 8,
    height: 40,
    padding: "0 14px",
    textAlign: "left",
    width: "100%",
  };
}

const partGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  margin: 0,
  padding: 0,
};

function partTileStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.soft,
    border: "none",
    borderRadius: 14,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "12px 6px",
    textAlign: "center",
    transition: `background-color ${MOTION.quickMs}ms ${MOTION.standard}`,
    width: "100%",
  };
}

const partNameRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "inline-flex",
  gap: 6,
};

function partDotStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    borderRadius: "50%",
    flex: "0 0 auto",
    height: 8,
    width: 8,
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 11,
    lineHeight: 1.5,
    margin: 0,
  };
}
