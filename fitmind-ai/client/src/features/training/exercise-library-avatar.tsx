import { useTheme } from "../../theme/ThemeContext";
import type { DictionaryExercise } from "./dictionary-api";
import { getBodyPartColor, getBodyPartForMuscleCode } from "./body-part";
import {
  getEquipmentGroup,
  getPrimaryMuscleCode,
} from "./exercise-library-model";

export interface ExerciseAvatarProps {
  exercise: DictionaryExercise;
  /** Diameter in px. */
  size?: number | undefined;
}

/**
 * Round placeholder illustration for an exercise.
 *
 * The dictionary has no images, so the circle is tinted with the primary
 * muscle's body-part color and carries a simple equipment mark. The same
 * exercise always draws the same avatar in the library and its detail sheet.
 *
 * @param props - Exercise and diameter
 * @returns Decorative avatar (hidden from assistive tech)
 */
export function ExerciseAvatar(props: ExerciseAvatarProps) {
  const { theme } = useTheme();
  const size = props.size ?? 64;
  const muscleCode = getPrimaryMuscleCode(props.exercise);
  const color = getBodyPartColor(
    theme,
    muscleCode ? getBodyPartForMuscleCode(muscleCode) : null,
  );
  const equipment = getEquipmentGroup(props.exercise.equipment).key;

  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${color} ${theme.isDark ? 30 : 22}%, transparent), color-mix(in srgb, ${color} ${theme.isDark ? 12 : 8}%, transparent) 72%), ${theme.colors.surf2}`,
        borderRadius: "50%",
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)`,
        color,
        display: "inline-flex",
        flex: "0 0 auto",
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <EquipmentGlyph equipment={equipment} size={Math.round(size * 0.6)} />
    </span>
  );
}

function EquipmentGlyph(props: { equipment: string; size: number }) {
  return (
    <svg
      fill="none"
      height={props.size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.6}
      viewBox="0 0 48 48"
      width={props.size}
    >
      {renderGlyph(props.equipment)}
    </svg>
  );
}

function renderGlyph(equipment: string): React.ReactNode {
  switch (equipment) {
    case "barbell":
      return (
        <>
          <path d="M4 24h40" />
          <rect
            fill="currentColor"
            height="18"
            rx="2"
            width="4"
            x="10"
            y="15"
          />
          <rect
            fill="currentColor"
            height="18"
            rx="2"
            width="4"
            x="34"
            y="15"
          />
          <rect
            fill="currentColor"
            height="11"
            rx="1.5"
            width="3"
            x="6"
            y="18.5"
          />
          <rect
            fill="currentColor"
            height="11"
            rx="1.5"
            width="3"
            x="39"
            y="18.5"
          />
        </>
      );
    case "dumbbell":
      return (
        <>
          <path d="M17 24h14" />
          <rect
            fill="currentColor"
            height="16"
            rx="2.5"
            width="6"
            x="11"
            y="16"
          />
          <rect
            fill="currentColor"
            height="16"
            rx="2.5"
            width="6"
            x="31"
            y="16"
          />
          <rect
            fill="currentColor"
            height="9"
            rx="1.5"
            width="3"
            x="7"
            y="19.5"
          />
          <rect
            fill="currentColor"
            height="9"
            rx="1.5"
            width="3"
            x="38"
            y="19.5"
          />
        </>
      );
    case "kettlebell":
      return (
        <>
          <path d="M17 22c-1-8 3-12 7-12s8 4 7 12" />
          <circle
            cx="24"
            cy="30"
            fill="currentColor"
            fillOpacity="0.28"
            r="11"
          />
        </>
      );
    case "cable":
      return (
        <>
          <circle cx="24" cy="10" r="5" />
          <path d="M24 15v15M24 30l-8 6M24 30l8 6M14 37h20" />
        </>
      );
    case "machine":
      return (
        <>
          <rect height="34" rx="3" width="24" x="12" y="7" />
          <path d="M24 7v14" />
          <path d="M16 25h16M16 30h16M16 35h16" />
        </>
      );
    case "plate":
      return (
        <>
          <circle
            cx="24"
            cy="24"
            fill="currentColor"
            fillOpacity="0.22"
            r="15"
          />
          <circle cx="24" cy="24" r="4" />
        </>
      );
    case "resistance_band":
      return (
        <path d="M10 30c0-12 8-16 14-8s14 4 14-8M10 30c0 6 6 8 10 4M38 14c0-6-6-8-10-4" />
      );
    case "bodyweight":
      return (
        <>
          <circle cx="24" cy="10" fill="currentColor" r="4" />
          <path d="M14 19l10-2 10 2M24 17v13M24 30l-7 10M24 30l7 10" />
        </>
      );
    case "sled":
      return <path d="M8 34h32M12 34l4-16h14l6 16M20 18v-6h6" />;
    default:
      return (
        <>
          <circle cx="24" cy="24" r="13" />
          <circle cx="24" cy="24" fill="currentColor" r="4" />
        </>
      );
  }
}
