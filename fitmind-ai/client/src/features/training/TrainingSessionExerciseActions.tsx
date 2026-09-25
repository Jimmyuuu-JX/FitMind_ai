import { useState } from "react";

import type { DraftExercise } from "./training-session-draft";

import { ActionSheet } from "../../components/ActionSheet";
import { Icon } from "../../components/Icon";
import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";
import { formatWeight, getExerciseDisplayName } from "./exercise-display";
import { SessionIcon } from "./TrainingSessionIcons";
import {
  TrainingSessionPopover,
  type PopoverAnchor,
  type PopoverMenuItem,
} from "./TrainingSessionPopover";
import { getExerciseSummary } from "./training-session-draft";

export interface TrainingSessionExerciseActionsProps {
  canMoveDown: boolean;
  canMoveUp: boolean;
  draftExercise: DraftExercise;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onReplace: () => void;
  /** Present only when the exercise has history to show. */
  onShowHistory?: (() => void) | undefined;
}

/**
 * The exercise card's gear button (训记 ⚙) and the menu it opens: details,
 * history, replace, reorder and remove.
 *
 * @param props - Exercise plus its card-level handlers
 * @returns Gear trigger, anchored menu and detail sheet
 */
export function TrainingSessionExerciseActions(
  props: TrainingSessionExerciseActionsProps,
) {
  const { theme } = useTheme();
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const summary = getExerciseSummary(props.draftExercise);
  const items: PopoverMenuItem[] = [
    {
      icon: <Icon name="eye" size={18} />,
      key: "detail",
      label: "动作详情",
      onSelect: () => setIsDetailOpen(true),
    },
  ];

  if (props.onShowHistory) {
    items.push({
      icon: <SessionIcon name="history" size={18} />,
      key: "history",
      label: "动作历史",
      onSelect: props.onShowHistory,
    });
  }

  items.push(
    {
      icon: <Icon name="refresh" size={18} />,
      key: "replace",
      label: "替换动作",
      onSelect: props.onReplace,
    },
    {
      disabled: !props.canMoveUp,
      // Icon has no chevron-up; flip the down chevron.
      icon: (
        <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
          <Icon name="chevron-down" size={18} />
        </span>
      ),
      key: "up",
      label: "上移",
      onSelect: props.onMoveUp,
      separated: true,
    },
    {
      disabled: !props.canMoveDown,
      icon: <Icon name="chevron-down" size={18} />,
      key: "down",
      label: "下移",
      onSelect: props.onMoveDown,
    },
    {
      icon: <Icon name="x" size={18} />,
      key: "remove",
      label: "删除动作",
      onSelect: props.onRemove,
      separated: true,
      tone: "danger",
    },
  );

  return (
    <>
      <button
        aria-expanded={anchor !== null}
        aria-haspopup="menu"
        aria-label="动作设置"
        onClick={(event) => {
          event.stopPropagation();
          setAnchor(event.currentTarget.getBoundingClientRect());
        }}
        style={gearButtonStyle(theme, anchor !== null)}
        type="button"
      >
        <SessionIcon name="gear" size={22} />
      </button>

      <TrainingSessionPopover
        anchor={anchor}
        ariaLabel={`${props.draftExercise.name}设置`}
        items={items}
        onClose={() => setAnchor(null)}
      />

      <ActionSheet
        description={
          props.draftExercise.exercise
            ? getExerciseDisplayName(props.draftExercise.exercise)
            : undefined
        }
        onClose={() => setIsDetailOpen(false)}
        open={isDetailOpen}
        showCloseButton
        title={props.draftExercise.name}
      >
        <div style={detailRowStyle(theme)}>
          <span>分类</span>
          <Pill tone="info">{props.draftExercise.categoryLabel}</Pill>
        </div>
        <div style={detailRowStyle(theme)}>
          <span>动作来源</span>
          <strong>系统动作库</strong>
        </div>
        <div style={detailRowStyle(theme)}>
          <span>本次训练</span>
          <strong>
            {summary.completedSets} 组 · 总容量{" "}
            {formatWeight(formatVolume(summary.totalVolumeKg))}
          </strong>
        </div>
      </ActionSheet>
    </>
  );
}

function formatVolume(totalVolumeKg: number): string {
  if (Number.isInteger(totalVolumeKg)) {
    return `${totalVolumeKg}`;
  }

  return totalVolumeKg.toFixed(2);
}

function gearButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isOpen: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    color: theme.colors.ac,
    cursor: "pointer",
    display: "flex",
    height: 40,
    justifyContent: "center",
    padding: 0,
    transform: isOpen ? "rotate(60deg)" : "rotate(0deg)",
    transition: "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
    width: 40,
  };
}

function detailRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf2,
    borderRadius: theme.radius.control,
    color: theme.colors.tx2,
    display: "flex",
    fontSize: 12,
    justifyContent: "space-between",
    padding: "10px 12px",
  };
}
