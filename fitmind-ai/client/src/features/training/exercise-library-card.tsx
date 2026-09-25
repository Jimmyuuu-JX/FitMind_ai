import { useState } from "react";

import { MOTION } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import type { DictionaryExercise } from "./dictionary-api";
import { getExerciseDisplayName } from "./exercise-display";
import { ExerciseAvatar } from "./exercise-library-avatar";

export interface ExerciseLibraryCardProps {
  exercise: DictionaryExercise;
  /** Highlights the card that was just picked while the page slides away. */
  isChosen?: boolean | undefined;
  onOpenDetail: (exercise: DictionaryExercise) => void;
  onPress: (exercise: DictionaryExercise) => void;
  reducedMotion?: boolean | undefined;
  /** Rendered as "N 次" only when the caller knows a real count. */
  usageCount?: number | undefined;
}

/**
 * One tile of the exercise library grid: round illustration, name, a 讲解
 * tag that opens the detail, and an optional usage count.
 *
 * @param props - Exercise, handlers and optional usage count
 * @returns Grid item
 */
export function ExerciseLibraryCard(props: ExerciseLibraryCardProps) {
  const { theme } = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  const { exercise } = props;
  const name = getExerciseDisplayName(exercise);
  const hasCues = exercise.technique_cues_zh.some((cue) => cue.trim());
  const tagLabel = hasCues ? "讲解" : "详情";

  return (
    <li style={{ listStyle: "none", minWidth: 0, position: "relative" }}>
      <button
        onClick={() => props.onPress(exercise)}
        onPointerCancel={() => setIsPressed(false)}
        onPointerDown={() => setIsPressed(true)}
        onPointerLeave={() => setIsPressed(false)}
        onPointerUp={() => setIsPressed(false)}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.surf,
          border: `1px solid ${props.isChosen ? theme.colors.ac : theme.colors.bdr}`,
          borderRadius: 16,
          color: theme.colors.tx,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          height: "100%",
          padding: "24px 8px 12px",
          transform: isPressed ? "scale(0.96)" : "scale(1)",
          transition: props.reducedMotion
            ? "none"
            : `transform ${MOTION.quickMs}ms ${MOTION.standard}, border-color ${MOTION.quickMs}ms ${MOTION.standard}`,
          width: "100%",
        }}
        type="button"
      >
        <ExerciseAvatar exercise={exercise} size={64} />
        <span
          style={{
            display: "-webkit-box",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.35,
            overflow: "hidden",
            textAlign: "center",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            wordBreak: "break-all",
          }}
        >
          {name}
        </span>
      </button>

      <button
        aria-label={`查看${name}${tagLabel}`}
        onClick={() => props.onOpenDetail(exercise)}
        style={{
          alignItems: "flex-start",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          height: 32,
          left: 0,
          padding: 0,
          position: "absolute",
          top: 0,
          width: 48,
        }}
        type="button"
      >
        <span
          style={{
            backgroundColor: theme.colors.ac,
            borderRadius: "16px 3px 10px 3px",
            color: theme.colors.acText,
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            padding: "5px 7px 4px 8px",
          }}
        >
          {tagLabel}
        </span>
      </button>

      {props.usageCount !== undefined && props.usageCount > 0 ? (
        <span
          style={{
            color: theme.colors.tx3,
            fontSize: 10,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            pointerEvents: "none",
            position: "absolute",
            right: 9,
            top: 7,
          }}
        >
          {props.usageCount} 次
        </span>
      ) : null}
    </li>
  );
}

/**
 * Placeholder tile shown while the dictionary loads for the first time.
 *
 * @returns Static skeleton grid item
 */
export function ExerciseLibraryCardSkeleton() {
  const { theme } = useTheme();

  return (
    <li
      aria-hidden="true"
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surf,
        border: `1px solid ${theme.colors.bdr}`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        listStyle: "none",
        padding: "24px 8px 14px",
      }}
    >
      <span
        style={{
          backgroundColor: theme.colors.surf2,
          borderRadius: "50%",
          height: 64,
          width: 64,
        }}
      />
      <span
        style={{
          backgroundColor: theme.colors.surf2,
          borderRadius: 6,
          height: 12,
          width: "60%",
        }}
      />
    </li>
  );
}
