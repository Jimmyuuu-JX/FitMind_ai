import type { DraftExercise, DraftSet } from "./training-session-draft";

import { Pill } from "../../components/Pill";
import { MOTION } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";
import {
  getEquipmentLabel,
  getMovementPatternLabel,
  getMuscleCodeLabel,
} from "./exercise-display";
import { TrainingSessionExerciseActions } from "./TrainingSessionExerciseActions";
import { SessionIcon } from "./TrainingSessionIcons";
import { TrainingSessionAccordion } from "./TrainingSessionReveal";
import { TrainingSessionSetRow } from "./TrainingSessionSetRow";
import { isDraftSetValid } from "./training-session-draft";
import {
  formatProgressAmount,
  getExerciseProgress,
} from "./training-session-progress";

/** Collapsed cards show at most this many set dots, then "+N". */
const MAX_DOTS = 12;

export interface TrainingSessionExerciseCardProps {
  draftExercise: DraftExercise;
  canMoveDown: boolean;
  canMoveUp: boolean;
  onAddSet: () => void;
  onClearSet?: ((setId: string) => void) | undefined;
  onCopySet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onResolveCandidate: (exerciseId: string) => void;
  /** Present only when the exercise can show its training history. */
  onShowHistory?: (() => void) | undefined;
  onStartRestTimer: (setId: string) => void;
  onToggleExpanded: () => void;
  onToggleSetCompleted: (setId: string) => void;
  onUpdateSet: <TField extends keyof DraftSet>(
    setId: string,
    field: TField,
    value: DraftSet[TField],
  ) => void;
}

/**
 * One exercise in the session (训记 card): round badge, name, "N 组", a dot
 * per set (green once done), done/total volume and the gear menu. Tapping the
 * card opens it in place into big per-set tiles with 新增一组 / 动作历史.
 *
 * @param props - Exercise draft and its handlers
 * @returns Accordion card
 */
export function TrainingSessionExerciseCard(
  props: TrainingSessionExerciseCardProps,
) {
  const { theme } = useTheme();
  const { draftExercise } = props;
  const progress = getExerciseProgress(draftExercise);
  const bodyId = `training-session-exercise-body-${draftExercise.id}`;
  const primaryMuscles = (draftExercise.exercise?.muscles ?? [])
    .filter((muscle) => muscle.is_primary)
    .slice(0, 2)
    .map((muscle) => muscle.code);
  const movementLabel = getMovementPatternLabel(
    draftExercise.exercise?.movement_pattern,
  );
  const equipmentLabel = getEquipmentLabel(draftExercise.exercise?.equipment);
  const isMatched = draftExercise.matchStatus === "matched";
  const hiddenDots = Math.max(0, progress.setCompletion.length - MAX_DOTS);

  return (
    <section
      id={`training-session-exercise-${draftExercise.id}`}
      onClick={(event) => event.stopPropagation()}
      style={cardStyle(theme, draftExercise.isExpanded)}
    >
      <div style={headerRowStyle}>
        <button
          aria-controls={bodyId}
          aria-expanded={draftExercise.isExpanded}
          onClick={props.onToggleExpanded}
          style={headerButtonStyle}
          type="button"
        >
          <span aria-hidden="true" style={badgeStyle(theme, progress.isDone)}>
            {getBadgeText(draftExercise)}
          </span>

          <span style={titleBlockStyle}>
            <strong style={nameStyle(theme)}>{draftExercise.name}</strong>
            <span style={subRowStyle(theme)}>
              {progress.totalSets} 组
              {!isMatched ? <Pill tone="warning">需要确认</Pill> : null}
            </span>
            {progress.setCompletion.length > 0 ? (
              <span
                aria-label={`已完成 ${progress.completedSets}/${progress.totalSets} 组`}
                role="img"
                style={dotRowStyle}
              >
                {progress.setCompletion
                  .slice(0, MAX_DOTS)
                  .map((isDone, index) => (
                    <span
                      key={draftExercise.sets[index]?.id ?? index}
                      style={dotStyle(theme, isDone)}
                    />
                  ))}
                {hiddenDots > 0 ? (
                  <span style={moreDotsStyle(theme)}>+{hiddenDots}</span>
                ) : null}
              </span>
            ) : null}
          </span>

          {progress.totalSets > 0 ? (
            <span style={amountStyle(theme)}>
              {formatProgressAmount(progress.completedAmount)}/
              {formatProgressAmount(progress.totalAmount)}
              {progress.metric === "reps" ? " 次" : ""}
            </span>
          ) : null}
        </button>

        <span aria-hidden="true" style={dividerStyle(theme)} />

        <TrainingSessionExerciseActions
          canMoveDown={props.canMoveDown}
          canMoveUp={props.canMoveUp}
          draftExercise={draftExercise}
          onMoveDown={props.onMoveDown}
          onMoveUp={props.onMoveUp}
          onRemove={props.onRemove}
          onReplace={props.onReplace}
          onShowHistory={props.onShowHistory}
        />
      </div>

      <TrainingSessionAccordion id={bodyId} open={draftExercise.isExpanded}>
        <div style={bodyStyle}>
          {movementLabel || equipmentLabel || primaryMuscles.length > 0 ? (
            <div style={metaRowStyle}>
              {movementLabel ? (
                <Pill tone="analysis">{movementLabel}</Pill>
              ) : null}
              {equipmentLabel ? (
                <Pill tone="neutral">{equipmentLabel}</Pill>
              ) : null}
              {primaryMuscles.map((muscleCode) => (
                <Pill key={muscleCode} tone="accent">
                  {getMuscleCodeLabel(muscleCode)}
                </Pill>
              ))}
            </div>
          ) : null}

          {!isMatched ? (
            <div style={resolutionPanelStyle(theme)}>
              <p style={resolutionCopyStyle(theme)}>
                {draftExercise.matchStatus === "ambiguous"
                  ? "这个动作需要先确认候选。"
                  : "未识别动作，请从动作库选择标准动作或删除。"}
              </p>
              {draftExercise.inputName ? (
                <p style={resolutionCopyStyle(theme)}>
                  原始输入：{draftExercise.inputName}
                </p>
              ) : null}
              {draftExercise.candidateExercises.length > 0 ? (
                <div style={candidateRowStyle}>
                  {draftExercise.candidateExercises.map((candidate) => (
                    <button
                      key={candidate.exerciseId}
                      onClick={() =>
                        props.onResolveCandidate(candidate.exerciseId)
                      }
                      style={candidateButtonStyle(theme)}
                      type="button"
                    >
                      {candidate.exerciseName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            {draftExercise.sets.map((setDraft, index) => (
              <TrainingSessionSetRow
                canComplete={isDraftSetValid(setDraft, draftExercise)}
                canDelete={draftExercise.sets.length > 1}
                index={index}
                isBodyweight={draftExercise.loadType === "bodyweight"}
                key={setDraft.id}
                onClear={
                  props.onClearSet
                    ? () => props.onClearSet?.(setDraft.id)
                    : undefined
                }
                onCopy={() => props.onCopySet(setDraft.id)}
                onDelete={() => props.onDeleteSet(setDraft.id)}
                onStartRestTimer={() => props.onStartRestTimer(setDraft.id)}
                onToggleCompleted={() =>
                  props.onToggleSetCompleted(setDraft.id)
                }
                onUpdate={(field, value) =>
                  props.onUpdateSet(setDraft.id, field, value)
                }
                setDraft={setDraft}
              />
            ))}
          </div>

          <div style={footerRowStyle(Boolean(props.onShowHistory))}>
            <button
              onClick={props.onAddSet}
              style={footerButtonStyle(theme)}
              type="button"
            >
              <SessionIcon name="plus" size={16} />
              新增一组
            </button>
            {props.onShowHistory ? (
              <button
                onClick={props.onShowHistory}
                style={footerButtonStyle(theme)}
                type="button"
              >
                <SessionIcon name="history" size={16} />
                动作历史
              </button>
            ) : null}
          </div>
        </div>
      </TrainingSessionAccordion>
    </section>
  );
}

/** First character of the category (胸/背/腿…) as the card's round badge. */
function getBadgeText(draftExercise: DraftExercise): string {
  const source = draftExercise.categoryLabel || draftExercise.name;

  return Array.from(source)[0] ?? "?";
}

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isExpanded: boolean,
): React.CSSProperties {
  return {
    background: `${theme.gradients.card}, ${theme.colors.surf}`,
    border: `1px solid ${isExpanded ? accentAlpha(theme, 0.45) : theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
    padding: "14px 10px 14px 14px",
    transition: `border-color ${MOTION.enterMs}ms ${MOTION.standard}`,
  };
}

const headerRowStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 4,
};

const headerButtonStyle: React.CSSProperties = {
  alignItems: "flex-start",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  flex: "1 1 auto",
  gap: 12,
  minWidth: 0,
  padding: 0,
  textAlign: "left",
};

function badgeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDone: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: isDone ? accentAlpha(theme, 0.18) : theme.colors.surf2,
    border: `1.5px solid ${isDone ? theme.colors.ac : theme.colors.bdr2}`,
    borderRadius: 999,
    color: isDone ? theme.colors.ac : theme.colors.tx2,
    display: "flex",
    flex: "0 0 auto",
    fontSize: 18,
    fontWeight: 700,
    height: 52,
    justifyContent: "center",
    transition: `background ${MOTION.enterMs}ms ${MOTION.standard}, border-color ${MOTION.enterMs}ms ${MOTION.standard}, color ${MOTION.enterMs}ms ${MOTION.standard}`,
    width: 52,
  };
}

const titleBlockStyle: React.CSSProperties = {
  display: "grid",
  flex: "1 1 auto",
  gap: 4,
  minWidth: 0,
  paddingTop: 2,
};

function nameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.3,
    overflowWrap: "anywhere",
  };
}

function subRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx3,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 12,
    gap: 8,
  };
}

const dotRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
  paddingTop: 4,
};

function dotStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDone: boolean,
): React.CSSProperties {
  return {
    background: isDone ? theme.colors.ac : theme.colors.bar,
    borderRadius: 999,
    height: 7,
    transform: isDone ? "scale(1.15)" : "scale(1)",
    transition: `background ${MOTION.enterMs}ms ${MOTION.standard}, transform ${MOTION.enterMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
    width: 7,
  };
}

function moreDotsStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 10,
  };
}

function amountStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    flex: "0 0 auto",
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    maxWidth: 108,
    paddingTop: 12,
    textAlign: "right",
    whiteSpace: "nowrap",
  };
}

function dividerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignSelf: "flex-start",
    background: theme.colors.bdr2,
    flex: "0 0 auto",
    height: 14,
    marginTop: 13,
    width: 1,
  };
}

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "14px 4px 0 0",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

function resolutionPanelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.orange}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 10,
    padding: 12,
  };
}

function resolutionCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

const candidateRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

function candidateButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 10px",
  };
}

function footerRowStyle(hasHistory: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: hasHistory ? "repeat(2, minmax(0, 1fr))" : "1fr",
  };
}

function footerButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.isDark ? theme.colors.bg : theme.colors.surf2,
    border: "none",
    borderRadius: 12,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    fontSize: 14,
    fontWeight: 700,
    gap: 6,
    height: 46,
    justifyContent: "center",
  };
}
