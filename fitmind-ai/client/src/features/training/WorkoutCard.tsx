import type { WorkoutSummaryDto } from "../../../../shared/src/training";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { getBodyPartColor, getWorkoutBodyPart } from "./body-part";
import { formatClock } from "./workout-detail-model";

export interface WorkoutCardProps {
  /** Whether this row's detail page is the one currently open. */
  isActive?: boolean | undefined;
  onOpen: () => void;
  workout: WorkoutSummaryDto;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * One workout in the history list: a tappable summary row whose detail opens
 * as a slide-up page (see WorkoutDetailSheet).
 *
 * @param props - Workout summary and the open handler
 * @returns Summary row button
 */
export function WorkoutCard(props: WorkoutCardProps) {
  const { theme } = useTheme();
  const { workout } = props;
  const part = getWorkoutBodyPart(workout);
  const color = getBodyPartColor(theme, part);
  const performedAt = new Date(workout.performed_at);
  const notes = workout.notes?.trim() || "未填写备注";
  const meta = [
    `${workout.sets_count} 组`,
    workout.duration_minutes !== null
      ? `${workout.duration_minutes} 分钟`
      : null,
    workout.total_volume !== undefined
      ? `${Math.round(workout.total_volume).toLocaleString()} kg`
      : null,
  ].filter(Boolean);

  return (
    <button
      aria-pressed={props.isActive ?? false}
      onClick={props.onOpen}
      style={cardStyle(theme, props.isActive ?? false)}
      type="button"
    >
      <span aria-hidden="true" style={stripeStyle(color)} />
      <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <span style={dateRowStyle(theme)}>
          <strong style={{ color: theme.colors.tx, fontSize: 14 }}>
            {performedAt.getMonth() + 1}/{performedAt.getDate()}{" "}
            {formatClock(workout.performed_at)}
          </strong>
          <span style={weekdayPillStyle(theme)}>
            {WEEKDAYS[performedAt.getDay()]}
          </span>
          {part ? (
            <span style={{ color, fontSize: 11, fontWeight: 800 }}>{part}</span>
          ) : null}
        </span>
        <span style={notesStyle(theme)}>{notes}</span>
        <span style={metaStyle(theme)}>{meta.join(" · ")}</span>
      </span>
      <span style={openHintStyle(theme)}>
        查看详情
        <Icon name="chevron-down" size={12} />
      </span>
    </button>
  );
}

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.surf2,
    border: `1px solid ${isActive ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 14,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "grid",
    gap: 12,
    gridTemplateColumns: "4px minmax(0, 1fr) auto",
    padding: "12px 14px 12px 10px",
    textAlign: "left",
    transition: "border-color 180ms ease, transform 120ms ease",
    width: "100%",
  };
}

function stripeStyle(color: string): React.CSSProperties {
  return { alignSelf: "stretch", background: color, borderRadius: 999 };
}

function dateRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx,
    display: "flex",
    gap: 8,
    minWidth: 0,
  };
}

function weekdayPillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.surf3,
    borderRadius: 20,
    color: theme.colors.tx2,
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 7px",
  };
}

function notesStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function metaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  };
}

function openHintStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.ac,
    display: "inline-flex",
    fontSize: 12,
    fontWeight: 700,
    gap: 3,
    whiteSpace: "nowrap",
  };
}
