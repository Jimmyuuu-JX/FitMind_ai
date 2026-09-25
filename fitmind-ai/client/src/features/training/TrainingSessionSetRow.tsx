import { useState } from "react";

import type { DraftSet, EffortLevel } from "./training-session-draft";

import { MOTION } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";
import { SessionIcon } from "./TrainingSessionIcons";
import {
  TrainingSessionPopover,
  type PopoverAnchor,
  type PopoverMenuItem,
} from "./TrainingSessionPopover";
import { TrainingSessionReveal } from "./TrainingSessionReveal";
import { cycleEffortLevel } from "./training-session-set-actions";

/** Non-negative decimal while typing ("", "60", "62.", "62.5"). */
const WEIGHT_PATTERN = /^\d{0,4}(\.\d{0,2})?$/;
/** Non-negative whole number while typing. */
const REPS_PATTERN = /^\d{0,3}$/;

const EFFORT_LABELS: Record<EffortLevel, string> = {
  easy: "简单",
  hard: "困难",
  normal: "正常",
};

export interface TrainingSessionSetRowProps {
  canComplete: boolean;
  canDelete: boolean;
  index: number;
  /** Bodyweight work shows "+kg" (added load) instead of "kg". */
  isBodyweight?: boolean | undefined;
  onClear?: (() => void) | undefined;
  onCopy: () => void;
  onDelete: () => void;
  onStartRestTimer?: (() => void) | undefined;
  onToggleCompleted: () => void;
  onUpdate: <TField extends keyof DraftSet>(
    field: TField,
    value: DraftSet[TField],
  ) => void;
  setDraft: DraftSet;
  showCompletion?: boolean | undefined;
}

type OpenMenu = { anchor: PopoverAnchor; kind: "index" | "row" } | null;

/**
 * One set as a row of big square tiles (训记): [序号/热] [kg] [次] [✓] 强度 ···.
 * Completed sets turn their tiles green; ticking plays the jelly pop and
 * draws the check. The index tile and ··· open anchored menus.
 *
 * @param props - Set draft, validity, and set-level handlers
 * @returns Animated set row
 */
export function TrainingSessionSetRow(props: TrainingSessionSetRowProps) {
  const { theme } = useTheme();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [isPopping, setIsPopping] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [focusedField, setFocusedField] = useState<"weight" | "reps" | null>(
    null,
  );
  const showCompletion = props.showCompletion ?? true;
  const isCompleted = showCompletion ? props.setDraft.completed : false;
  const setNumber = props.index + 1;
  const { setDraft } = props;

  return (
    <TrainingSessionReveal
      isLeaving={isLeaving}
      onExited={props.onDelete}
      spacing={8}
    >
      <div
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) {
            setIsPopping(false);
          }
        }}
        style={rowStyle(isPopping)}
      >
        <button
          aria-haspopup="menu"
          aria-label={`第 ${setNumber} 组设置${setDraft.isWarmup ? "（热身组）" : ""}`}
          onClick={(event) =>
            setOpenMenu({
              anchor: event.currentTarget.getBoundingClientRect(),
              kind: "index",
            })
          }
          style={indexTileStyle(theme, setDraft.isWarmup)}
          type="button"
        >
          {setDraft.isWarmup ? "热" : setNumber}
        </button>

        <label
          style={valueTileStyle(theme, isCompleted, focusedField === "weight")}
        >
          <span style={tileCaptionStyle(theme, isCompleted)}>
            {props.isBodyweight ? "+kg" : "kg"}
          </span>
          <input
            aria-label={`第 ${setNumber} 组重量（公斤）`}
            inputMode="decimal"
            onBlur={() => setFocusedField(null)}
            onChange={(event) => {
              if (WEIGHT_PATTERN.test(event.target.value)) {
                props.onUpdate("weightKg", event.target.value);
              }
            }}
            onFocus={() => setFocusedField("weight")}
            style={valueInputStyle(theme)}
            type="text"
            value={setDraft.weightKg}
          />
        </label>

        <label
          style={valueTileStyle(theme, isCompleted, focusedField === "reps")}
        >
          <span style={tileCaptionStyle(theme, isCompleted)}>次</span>
          <input
            aria-label={`第 ${setNumber} 组次数`}
            inputMode="numeric"
            onBlur={() => setFocusedField(null)}
            onChange={(event) => {
              if (REPS_PATTERN.test(event.target.value)) {
                props.onUpdate("reps", event.target.value);
              }
            }}
            onFocus={() => setFocusedField("reps")}
            style={valueInputStyle(theme)}
            type="text"
            value={setDraft.reps}
          />
        </label>

        {showCompletion ? (
          <button
            aria-label={
              isCompleted
                ? `取消完成第 ${setNumber} 组`
                : `完成第 ${setNumber} 组`
            }
            aria-pressed={isCompleted}
            disabled={!props.canComplete}
            onClick={() => {
              if (!isCompleted) {
                setIsPopping(true);
              }
              props.onToggleCompleted();
            }}
            style={checkTileStyle(theme, isCompleted)}
            type="button"
          >
            <span style={checkIconStyle(isPopping)}>
              <SessionIcon name="check" size={26} strokeWidth={2.6} />
            </span>
          </button>
        ) : (
          <span />
        )}

        <button
          aria-label={`第 ${setNumber} 组强度：${EFFORT_LABELS[setDraft.effort]}，点按切换`}
          onClick={() =>
            props.onUpdate("effort", cycleEffortLevel(setDraft.effort))
          }
          style={effortChipStyle(theme, setDraft.effort)}
          type="button"
        >
          {EFFORT_LABELS[setDraft.effort]}
        </button>

        <button
          aria-haspopup="menu"
          aria-label={`第 ${setNumber} 组更多操作`}
          onClick={(event) =>
            setOpenMenu({
              anchor: event.currentTarget.getBoundingClientRect(),
              kind: "row",
            })
          }
          style={moreButtonStyle(theme)}
          type="button"
        >
          <SessionIcon name="more" size={22} strokeWidth={3} />
        </button>
      </div>

      {isCompleted && setDraft.restSeconds ? (
        <p style={restNoteStyle(theme)}>
          休息 {formatRestLabel(setDraft.restSeconds)}
        </p>
      ) : null}

      <TrainingSessionPopover
        align={openMenu?.kind === "index" ? "start" : "end"}
        anchor={openMenu?.anchor ?? null}
        ariaLabel={`第 ${setNumber} 组操作`}
        items={openMenu?.kind === "index" ? buildIndexMenu() : buildRowMenu()}
        onClose={() => setOpenMenu(null)}
      />
    </TrainingSessionReveal>
  );

  function buildIndexMenu(): PopoverMenuItem[] {
    const items: PopoverMenuItem[] = [warmupItem()];

    if (props.onClear) {
      items.push({
        key: "clear",
        label: "清空",
        onSelect: props.onClear,
        separated: true,
        tone: "danger",
      });
    }

    return items;
  }

  function buildRowMenu(): PopoverMenuItem[] {
    const items: PopoverMenuItem[] = [];

    if (props.onStartRestTimer) {
      items.push({
        disabled: !props.canComplete,
        key: "rest",
        label: "手动开始休息计时",
        onSelect: props.onStartRestTimer,
      });
    }

    items.push(
      { key: "copy", label: "复制本组", onSelect: props.onCopy },
      warmupItem(),
    );

    if (props.canDelete) {
      items.push({
        key: "delete",
        label: "删除",
        onSelect: () => setIsLeaving(true),
        separated: true,
        tone: "danger",
      });
    }

    return items;
  }

  function warmupItem(): PopoverMenuItem {
    return {
      key: "warmup",
      label: setDraft.isWarmup ? "取消热身组" : "设为热身组",
      onSelect: () => props.onUpdate("isWarmup", !setDraft.isWarmup),
    };
  }
}

function formatRestLabel(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const TILE_HEIGHT = 52;

function rowStyle(isPopping: boolean): React.CSSProperties {
  return {
    alignItems: "center",
    animation: isPopping
      ? "fmjelly 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
      : "none",
    display: "grid",
    gap: 6,
    gridTemplateColumns: "40px minmax(0, 1fr) minmax(0, 1fr) 50px 38px 26px",
  };
}

/** Uncompleted tile fill: a step darker/lighter than the card surface. */
function tileBackground(theme: ReturnType<typeof useTheme>["theme"]): string {
  return theme.isDark ? theme.colors.bg : theme.colors.surf2;
}

function indexTileStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isWarmup: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: tileBackground(theme),
    border: "none",
    borderRadius: 12,
    color: isWarmup ? theme.colors.orange : theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    fontSize: 16,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    height: TILE_HEIGHT,
    justifyContent: "center",
    padding: 0,
    transition: `color ${MOTION.quickMs}ms ${MOTION.standard}`,
  };
}

function valueTileStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCompleted: boolean,
  isFocused: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: isCompleted
      ? accentAlpha(theme, theme.isDark ? 0.2 : 0.16)
      : tileBackground(theme),
    borderRadius: 12,
    boxShadow: isFocused ? `inset 0 0 0 1.5px ${theme.colors.ac}` : "none",
    color: theme.colors.tx,
    cursor: "text",
    display: "flex",
    height: TILE_HEIGHT,
    justifyContent: "center",
    minWidth: 0,
    position: "relative",
    transition: `background ${MOTION.enterMs}ms ${MOTION.standard}, box-shadow ${MOTION.quickMs}ms ${MOTION.standard}`,
  };
}

function tileCaptionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCompleted: boolean,
): React.CSSProperties {
  return {
    color: isCompleted ? theme.colors.accDim : theme.colors.tx3,
    fontSize: 10,
    fontWeight: 600,
    left: 7,
    lineHeight: 1,
    pointerEvents: "none",
    position: "absolute",
    top: 5,
  };
}

function valueInputStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    height: "100%",
    outline: "none",
    padding: "10px 4px 0",
    textAlign: "center",
    width: "100%",
  };
}

function checkTileStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isCompleted: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: isCompleted ? theme.colors.ac : tileBackground(theme),
    border: "none",
    borderRadius: 12,
    color: isCompleted ? theme.colors.acText : theme.colors.tx3,
    cursor: "pointer",
    display: "flex",
    height: TILE_HEIGHT,
    justifyContent: "center",
    padding: 0,
    transition: `background ${MOTION.enterMs}ms ${MOTION.standard}, color ${MOTION.quickMs}ms ${MOTION.standard}`,
  };
}

function checkIconStyle(isPopping: boolean): React.CSSProperties {
  return {
    animation: isPopping ? `fmcheck 360ms ${MOTION.easeOut}` : "none",
    display: "inline-flex",
    strokeDasharray: 30,
  };
}

function effortChipStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  effort: EffortLevel,
): React.CSSProperties {
  const color =
    effort === "easy"
      ? theme.colors.green
      : effort === "hard"
        ? theme.colors.red
        : theme.colors.orange;

  return {
    background: "transparent",
    border: `1.5px solid ${color}`,
    borderRadius: 999,
    color,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    height: 26,
    padding: 0,
    transition: `color ${MOTION.quickMs}ms ${MOTION.standard}, border-color ${MOTION.quickMs}ms ${MOTION.standard}`,
    whiteSpace: "nowrap",
  };
}

function moreButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    color: theme.colors.ac,
    cursor: "pointer",
    display: "flex",
    height: TILE_HEIGHT,
    justifyContent: "center",
    padding: 0,
  };
}

function restNoteStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    margin: "-2px 0 6px 46px",
  };
}
