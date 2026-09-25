import { createPortal } from "react-dom";

import {
  MOTION,
  presenceTransition,
  usePresence,
} from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { SessionIcon, type SessionIconName } from "./TrainingSessionIcons";
import { TrainingSessionTimer } from "./TrainingSessionTimer";
import {
  formatElapsedTime,
  formatProgressAmount,
  type SessionProgress,
} from "./training-session-progress";

/* ------------------------------------------------------------------ header */

export interface TrainingSessionHeaderProps {
  canComplete: boolean;
  /** Past session length, shown instead of the live clock. */
  durationMin: number | null;
  elapsedSeconds: number;
  isActiveSession: boolean;
  isRunning: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onComplete: () => void;
  onEditTime: () => void;
  onToggleRunning: () => void;
  progress: SessionProgress;
  timeSummary: string;
}

/**
 * Session page header (训记): the big clock with play/pause on the left, the
 * 取消 / 完成 pills on the right, then a title row (live status, or the
 * editable training time for a past session) beside done/total progress.
 *
 * @param props - Clock, progress and header actions
 * @returns Page header
 */
export function TrainingSessionHeader(props: TrainingSessionHeaderProps) {
  const { theme } = useTheme();
  const { progress } = props;

  return (
    <header style={headerStyle(theme)}>
      <div style={topRowStyle}>
        {props.isActiveSession ? (
          <TrainingSessionTimer
            elapsedSeconds={props.elapsedSeconds}
            isRunning={props.isRunning}
            onToggleRunning={props.onToggleRunning}
          />
        ) : (
          <span style={durationStyle(theme, props.durationMin === null)}>
            {props.durationMin === null
              ? "未记录时长"
              : formatElapsedTime(props.durationMin * 60)}
          </span>
        )}

        <div style={actionGroupStyle}>
          <button
            disabled={props.isSubmitting}
            onClick={props.onCancel}
            style={cancelPillStyle(theme)}
            type="button"
          >
            取消
          </button>
          <button
            disabled={!props.canComplete || props.isSubmitting}
            onClick={props.onComplete}
            style={completePillStyle(theme)}
            type="button"
          >
            {props.isSubmitting ? "保存中..." : "完成"}
          </button>
        </div>
      </div>

      <div style={titleRowStyle}>
        {props.isActiveSession ? (
          <span style={statusStyle(theme)}>
            <span style={statusDotStyle(theme, props.isRunning)} />
            {props.isRunning ? "训练进行中" : "等待开始"}
          </span>
        ) : (
          <button
            aria-label={`训练时间 ${props.timeSummary}`}
            onClick={props.onEditTime}
            style={timeButtonStyle(theme)}
            type="button"
          >
            <SessionIcon name="pencil" size={18} />
            <span style={timeTextStyle}>{props.timeSummary}</span>
          </button>
        )}

        <div style={progressStyle(theme)}>
          <span>
            <strong style={progressValueStyle(theme)}>
              {progress.completedSets}
            </strong>
            /{progress.totalSets} 组 ·{" "}
            <strong style={progressValueStyle(theme)}>
              {progress.completedExercises}
            </strong>
            /{progress.totalExercises} 动作
          </span>
          <span>
            <strong style={progressValueStyle(theme)}>
              {formatProgressAmount(progress.completedVolumeKg)}
            </strong>
            /{formatProgressAmount(progress.totalVolumeKg)} 容量
          </span>
        </div>
      </div>
    </header>
  );
}

function headerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.bg,
    borderBottom: `1px solid ${theme.colors.bdr}`,
    display: "grid",
    gap: 14,
    padding: "max(14px, env(safe-area-inset-top, 14px)) 16px 14px",
  };
}

const topRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
  minWidth: 0,
};

function durationStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isUnset: boolean,
): React.CSSProperties {
  return {
    color: isUnset ? theme.colors.tx3 : theme.colors.tx,
    fontSize: isUnset ? 26 : 38,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
}

const actionGroupStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flex: "0 0 auto",
  gap: 8,
};

function cancelPillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.surf2,
    border: "none",
    borderRadius: 999,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    height: 38,
    padding: "0 14px",
  };
}

function completePillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.ac,
    border: "none",
    borderRadius: 999,
    color: theme.colors.acText,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
    height: 38,
    padding: "0 20px",
  };
}

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  minWidth: 0,
};

function statusStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx,
    display: "flex",
    fontSize: 17,
    fontWeight: 600,
    gap: 8,
    minWidth: 0,
  };
}

function statusDotStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isRunning: boolean,
): React.CSSProperties {
  return {
    animation: isRunning ? "fmpulse 1.6s ease-in-out infinite" : "none",
    background: isRunning ? theme.colors.ac : theme.colors.tx3,
    borderRadius: 999,
    height: 8,
    transition: `background ${MOTION.quickMs}ms ${MOTION.standard}`,
    width: 8,
  };
}

function timeButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    fontSize: 16,
    fontWeight: 600,
    gap: 8,
    minWidth: 0,
    padding: 0,
    textAlign: "left",
  };
}

const timeTextStyle: React.CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
};

function progressStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    flex: "0 0 auto",
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    gap: 2,
    justifyItems: "end",
    lineHeight: 1.35,
    textAlign: "right",
  };
}

function progressValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontWeight: 700,
  };
}

/* ----------------------------------------------------------------- toolbar */

export interface ToolbarAction {
  icon: SessionIconName;
  /** Shows a small accent dot (e.g. notes already written). */
  isMarked?: boolean | undefined;
  key: string;
  label: string;
  onClick: (trigger: HTMLButtonElement) => void;
}

export interface TrainingSessionToolbarProps {
  /** Left of the center 加动作 button. */
  leading: ToolbarAction[];
  onAdd: () => void;
  /** Right of the center 加动作 button. */
  trailing: ToolbarAction[];
}

/**
 * Bottom toolbar (训记): side actions around a raised accent 加动作 button.
 *
 * @param props - Actions either side of the center button
 * @returns Toolbar
 */
export function TrainingSessionToolbar(props: TrainingSessionToolbarProps) {
  const { theme } = useTheme();
  const columns = props.leading.length + props.trailing.length + 1;

  return (
    <nav aria-label="训练操作" style={toolbarStyle(theme, columns)}>
      {props.leading.map((action) => (
        <ToolbarButton action={action} key={action.key} />
      ))}
      <button
        onClick={props.onAdd}
        style={toolbarButtonStyle(theme)}
        type="button"
      >
        <span style={addCircleStyle(theme)}>
          <SessionIcon name="plus" size={22} strokeWidth={2.6} />
        </span>
        <span>加动作</span>
      </button>
      {props.trailing.map((action) => (
        <ToolbarButton action={action} key={action.key} />
      ))}
    </nav>
  );
}

function ToolbarButton(props: { action: ToolbarAction }) {
  const { theme } = useTheme();

  return (
    <button
      onClick={(event) => props.action.onClick(event.currentTarget)}
      style={toolbarButtonStyle(theme)}
      type="button"
    >
      <span style={toolbarIconStyle}>
        <SessionIcon name={props.action.icon} size={24} strokeWidth={1.8} />
        {props.action.isMarked ? (
          <span aria-hidden="true" style={markStyle(theme)} />
        ) : null}
      </span>
      <span>{props.action.label}</span>
    </button>
  );
}

function toolbarStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  columns: number,
): React.CSSProperties {
  return {
    background: theme.colors.bg,
    borderTop: `1px solid ${theme.colors.bdr}`,
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    padding: "8px 8px calc(8px + env(safe-area-inset-bottom, 0px))",
  };
}

function toolbarButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    color: theme.colors.tx2,
    cursor: "pointer",
    display: "grid",
    fontSize: 11,
    fontWeight: 600,
    gap: 4,
    justifyItems: "center",
    minHeight: 52,
    padding: "2px 0",
  };
}

const toolbarIconStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  height: 30,
  justifyContent: "center",
  position: "relative",
};

function markStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.ac,
    borderRadius: 999,
    height: 7,
    position: "absolute",
    right: -4,
    top: 2,
    width: 7,
  };
}

function addCircleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.ac,
    borderRadius: 999,
    color: theme.colors.acText,
    display: "flex",
    height: 34,
    justifyContent: "center",
    width: 34,
  };
}

/* ---------------------------------------------------------- minimized pill */

export interface TrainingSessionMinimizedPillProps {
  elapsedSeconds: number;
  isRunning: boolean;
  onRestore: () => void;
  open: boolean;
}

/**
 * While the live session is minimized, a floating capsule above the tab bar
 * keeps the clock visible and brings the session back on tap.
 *
 * @param props - Clock, visibility and restore handler
 * @returns Portal-mounted capsule, or null when hidden
 */
export function TrainingSessionMinimizedPill(
  props: TrainingSessionMinimizedPillProps,
) {
  const { theme } = useTheme();
  const presence = usePresence(props.open);

  if (!presence.isMounted) {
    return null;
  }

  return createPortal(
    <button
      aria-label={`返回训练 ${formatElapsedTime(props.elapsedSeconds)}`}
      onClick={props.onRestore}
      style={{
        alignItems: "center",
        background: theme.colors.ac,
        border: "none",
        borderRadius: 999,
        bottom: "calc(max(10px, env(safe-area-inset-bottom, 0px)) + 74px)",
        boxShadow: `0 10px 28px ${theme.colors.sh40}`,
        color: theme.colors.acText,
        cursor: "pointer",
        display: "flex",
        fontSize: 14,
        fontWeight: 800,
        gap: 8,
        left: "50%",
        opacity: presence.isVisible ? 1 : 0,
        padding: "10px 18px",
        position: "fixed",
        transform: `translate(-50%, ${presence.isVisible ? "0" : "24px"}) scale(${presence.isVisible ? 1 : 0.9})`,
        transition: presenceTransition(presence, ["transform", "opacity"]),
        zIndex: 350,
      }}
      type="button"
    >
      <SessionIcon
        name={props.isRunning ? "timer" : "pause"}
        size={16}
        strokeWidth={2.4}
      />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatElapsedTime(props.elapsedSeconds)}
      </span>
      <span>继续训练</span>
    </button>,
    document.body,
  );
}
