import { useState } from "react";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/Input";
import { MOTION } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";
import { SessionIcon } from "./TrainingSessionIcons";
import { TrainingSessionAccordion } from "./TrainingSessionReveal";

const REST_TIMER_OPTIONS = [30, 60, 90, 120] as const;

export type RestTimerStatus = "selecting" | "running" | "paused" | "finished";

export interface RestTimerState {
  isRunning: boolean;
  remainingSeconds: number;
  sourceSetId?: string | undefined;
  status: RestTimerStatus;
  totalSeconds: number;
}

export interface TrainingSessionRestTimerProps {
  onClose: () => void;
  onConfirmDuration: (seconds: number) => void;
  onToggleRunning: () => void;
  timer: RestTimerState | null;
}

/**
 * Rest countdown. Picking a duration happens in a sheet; the countdown itself
 * is a slim bar above the toolbar that grows in and out of place, so the
 * lifter can keep logging while resting.
 *
 * @param props - Timer state and handlers
 * @returns Duration sheet plus countdown bar
 */
export function TrainingSessionRestTimer(props: TrainingSessionRestTimerProps) {
  const { theme } = useTheme();
  const [customRestSeconds, setCustomRestSeconds] = useState("150");
  const isCounting = props.timer !== null && props.timer.status !== "selecting";
  const [lastCountdown, setLastCountdown] = useState<RestTimerState | null>(
    isCounting ? props.timer : null,
  );

  // Keep the last countdown on screen while the bar collapses away.
  if (isCounting && props.timer !== lastCountdown) {
    setLastCountdown(props.timer);
  }

  const countdown = isCounting ? props.timer : lastCountdown;
  const progress =
    countdown && countdown.totalSeconds > 0
      ? Math.max(
          0,
          Math.min(1, countdown.remainingSeconds / countdown.totalSeconds),
        )
      : 0;

  return (
    <>
      <ActionSheet
        onClose={props.onClose}
        open={props.timer?.status === "selecting"}
        showCloseButton
        title="设置休息倒计时"
      >
        <div style={optionGridStyle}>
          {REST_TIMER_OPTIONS.map((seconds) => (
            <button
              key={seconds}
              onClick={() => props.onConfirmDuration(seconds)}
              style={optionButtonStyle(theme)}
              type="button"
            >
              {seconds} 秒
            </button>
          ))}
        </div>

        <div style={customRowStyle}>
          <Input
            aria-label="自定义休息秒数"
            min="1"
            onChange={(event) => setCustomRestSeconds(event.target.value)}
            type="number"
            value={customRestSeconds}
          />
          <Button
            disabled={!isValidRestSeconds(customRestSeconds)}
            onClick={() =>
              props.onConfirmDuration(Number.parseInt(customRestSeconds, 10))
            }
            type="button"
            variant="secondary"
          >
            自定义
          </Button>
        </div>
      </ActionSheet>

      <TrainingSessionAccordion open={isCounting}>
        {countdown ? (
          <div
            aria-label="休息倒计时"
            role="group"
            style={barStyle(theme, countdown.status)}
          >
            <span style={barIconStyle(theme, countdown.status)}>
              {countdown.status === "finished" ? (
                <Icon name="check" size={16} />
              ) : (
                <SessionIcon name="timer" size={16} />
              )}
            </span>
            <span style={barCopyStyle}>
              <span style={barTitleStyle(theme)}>
                {countdown.status === "finished"
                  ? "休息结束，可以开始下一组了"
                  : countdown.status === "paused"
                    ? "休息已暂停"
                    : "休息中"}
              </span>
              <span style={progressTrackStyle(theme)}>
                <span style={progressFillStyle(theme, progress)} />
              </span>
            </span>
            <strong style={countdownStyle(theme)}>
              {formatRestTime(countdown.remainingSeconds)}
            </strong>
            {countdown.status !== "finished" ? (
              <button
                aria-label={countdown.status === "paused" ? "继续" : "暂停"}
                onClick={props.onToggleRunning}
                style={barButtonStyle(theme)}
                type="button"
              >
                <SessionIcon
                  name={countdown.status === "paused" ? "play" : "pause"}
                  size={14}
                  strokeWidth={2.6}
                />
              </button>
            ) : null}
            <button
              aria-label="关闭休息倒计时"
              onClick={props.onClose}
              style={barButtonStyle(theme)}
              type="button"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ) : null}
      </TrainingSessionAccordion>
    </>
  );
}

function isValidRestSeconds(value: string): boolean {
  const seconds = Number.parseInt(value, 10);

  return Number.isInteger(seconds) && seconds > 0;
}

function formatRestTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const optionGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

function optionButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    padding: "14px 10px",
  };
}

const customRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "minmax(0, 1fr) auto",
};

function barStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  status: RestTimerStatus,
): React.CSSProperties {
  return {
    alignItems: "center",
    background:
      status === "finished" ? accentAlpha(theme, 0.14) : theme.colors.surf,
    border: `1px solid ${status === "finished" ? accentAlpha(theme, 0.4) : theme.colors.bdr}`,
    borderRadius: 16,
    display: "flex",
    gap: 10,
    margin: "0 12px 8px",
    padding: "10px 10px 10px 12px",
    transition: `background ${MOTION.enterMs}ms ${MOTION.standard}, border-color ${MOTION.enterMs}ms ${MOTION.standard}`,
  };
}

function barIconStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  status: RestTimerStatus,
): React.CSSProperties {
  return {
    color: status === "finished" ? theme.colors.ac : theme.colors.orange,
    display: "inline-flex",
  };
}

const barCopyStyle: React.CSSProperties = {
  display: "grid",
  flex: "1 1 auto",
  gap: 6,
  minWidth: 0,
};

function barTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function countdownStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 22,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
    lineHeight: 1,
  };
}

function progressTrackStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 999,
    display: "block",
    height: 4,
    overflow: "hidden",
  };
}

function progressFillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  progress: number,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.orange,
    borderRadius: 999,
    display: "block",
    height: "100%",
    transition: "width 1s linear",
    width: `${progress * 100}%`,
  };
}

function barButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.surf2,
    border: "none",
    borderRadius: 999,
    color: theme.colors.tx2,
    cursor: "pointer",
    display: "flex",
    flex: "0 0 auto",
    height: 32,
    justifyContent: "center",
    padding: 0,
    width: 32,
  };
}
