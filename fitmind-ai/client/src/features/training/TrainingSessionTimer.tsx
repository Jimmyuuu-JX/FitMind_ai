import { MOTION } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { SessionIcon } from "./TrainingSessionIcons";
import { formatElapsedTime } from "./training-session-progress";

export interface TrainingSessionTimerProps {
  elapsedSeconds: number;
  isRunning: boolean;
  /** Omit for a static readout (a past session's duration). */
  onToggleRunning?: (() => void) | undefined;
}

/**
 * The session clock (训记 01:11:51) with its round play/pause control.
 *
 * @param props - Elapsed time, running state and toggle
 * @returns Large timer readout
 */
export function TrainingSessionTimer(props: TrainingSessionTimerProps) {
  const { theme } = useTheme();

  return (
    <div style={timerWrapStyle}>
      <span
        aria-label={`训练计时 ${formatElapsedTime(props.elapsedSeconds)}`}
        role="timer"
        style={timerValueStyle(theme)}
      >
        {formatElapsedTime(props.elapsedSeconds)}
      </span>
      {props.onToggleRunning ? (
        <button
          aria-label={props.isRunning ? "暂停计时" : "开始计时"}
          onClick={props.onToggleRunning}
          style={toggleStyle(theme, props.isRunning)}
          type="button"
        >
          <SessionIcon
            name={props.isRunning ? "pause" : "play"}
            size={16}
            strokeWidth={2.6}
          />
        </button>
      ) : null}
    </div>
  );
}

const timerWrapStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
  minWidth: 0,
};

function timerValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 38,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
}

function toggleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isRunning: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: isRunning ? theme.colors.surf2 : theme.colors.ac,
    border: "none",
    borderRadius: 999,
    color: isRunning ? theme.colors.tx2 : theme.colors.acText,
    cursor: "pointer",
    display: "flex",
    flex: "0 0 auto",
    height: 34,
    justifyContent: "center",
    padding: 0,
    transition: `background ${MOTION.quickMs}ms ${MOTION.standard}, color ${MOTION.quickMs}ms ${MOTION.standard}`,
    width: 34,
  };
}
