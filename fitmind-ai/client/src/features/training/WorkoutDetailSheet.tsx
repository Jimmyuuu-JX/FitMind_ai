import type {
  WorkoutDetailDto,
  WorkoutSummaryDto,
} from "../../../../shared/src/training";

import { Icon } from "../../components/Icon";
import { MOTION, usePrefersReducedMotion } from "../../components/motion";
import { SlideUpPage } from "../../components/SlideUpPage";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { getBodyPartColor, getWorkoutBodyPart } from "./body-part";
import {
  formatClock,
  formatDurationZh,
  formatKg,
  getWorkoutMinutes,
  groupWorkoutSets,
} from "./workout-detail-model";

export interface WorkoutDetailSheetProps {
  detail: WorkoutDetailDto | null;
  errorMessage: string | null;
  exerciseNames: Map<string, string>;
  isDeleting: boolean;
  isLoading: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  /** Opens another session from the same day. */
  onSwitchSession?: ((workoutId: string) => void) | undefined;
  open: boolean;
  /** All sessions on this workout's day, earliest first; tabs show when > 1. */
  sessions?: WorkoutSummaryDto[] | undefined;
  /** The list row that was opened; shown while the detail loads. */
  workout: WorkoutSummaryDto | null;
}

/**
 * Read-only page for one past workout, sliding up from the calendar or list.
 *
 * Mirrors the 训记 detail page: session name and body-part tag, a stat row
 * (volume, sets, duration with clock range, date), then each exercise with
 * its sets. Editing is a deliberate second step through 编辑数据, which opens
 * the session editor on top of this page.
 *
 * @param props - Workout, its detail load state, and the page actions
 * @returns Slide-up detail page
 */
export function WorkoutDetailSheet(props: WorkoutDetailSheetProps) {
  const { theme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const { detail, workout } = props;
  const isCurrent =
    detail !== null && workout !== null && detail.id === workout.id;
  const shownDetail = isCurrent ? detail : null;
  const part = workout ? getWorkoutBodyPart(workout) : null;
  const partColor = getBodyPartColor(theme, part);
  const groups = shownDetail
    ? groupWorkoutSets(shownDetail.sets, props.exerciseNames)
    : [];
  const totalVolume = groups.reduce((sum, group) => sum + group.totalVolume, 0);
  const minutes = shownDetail ? getWorkoutMinutes(shownDetail) : null;
  const performedAt = workout ? new Date(workout.performed_at) : null;
  const title = workout?.notes?.trim() || "训练记录";

  return (
    <SlideUpPage
      ariaLabel={`训练详情：${title}`}
      footer={
        <div style={footerStyle(theme)}>
          <button
            disabled={!shownDetail || props.isDeleting}
            onClick={props.onEdit}
            style={primaryButtonStyle(theme)}
            type="button"
          >
            编辑数据
          </button>
          <button
            disabled={!workout || props.isDeleting}
            onClick={props.onDelete}
            style={secondaryButtonStyle(theme)}
            type="button"
          >
            {props.isDeleting ? "删除中…" : "删除"}
          </button>
        </div>
      }
      header={
        <div style={topBarStyle(theme)}>
          <button
            aria-label="关闭训练详情"
            onClick={props.onClose}
            style={closeButtonStyle(theme)}
            type="button"
          >
            <Icon name="x" size={20} />
          </button>
          <span aria-hidden="true" style={grabberStyle(theme)} />
          <span style={{ width: 40 }} />
        </div>
      }
      onClose={props.onClose}
      open={props.open}
      zIndex={900}
    >
      <style>{DETAIL_KEYFRAMES}</style>
      <div style={{ display: "grid", gap: 18, padding: "18px 18px 24px" }}>
        <header style={{ display: "grid", gap: 14 }}>
          <div style={titleRowStyle}>
            <h2 style={titleStyle}>{title}</h2>
            {part ? (
              <span
                style={{
                  background: partColor,
                  borderRadius: 10,
                  color: theme.isDark ? "#0f0f0f" : "#ffffff",
                  flex: "0 0 auto",
                  fontSize: 13,
                  fontWeight: 800,
                  padding: "6px 12px",
                }}
              >
                {part}
              </span>
            ) : null}
          </div>

          {props.sessions && props.sessions.length > 1 ? (
            <div
              aria-label="当天的训练"
              role="tablist"
              style={sessionTabsStyle}
            >
              {props.sessions.map((session, index) => {
                const isActive = session.id === workout?.id;

                return (
                  <button
                    aria-selected={isActive}
                    key={session.id}
                    onClick={() => props.onSwitchSession?.(session.id)}
                    role="tab"
                    style={sessionTabStyle(theme, isActive)}
                    type="button"
                  >
                    第 {index + 1} 次 · {formatClock(session.performed_at)}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div style={statRowStyle}>
            <Stat
              label="容量"
              unit="kg"
              value={
                shownDetail ? Math.round(totalVolume).toLocaleString() : "—"
              }
            />
            <Stat
              label="组数"
              unit="组"
              value={`${shownDetail?.sets.length ?? workout?.sets_count ?? 0}`}
            />
            <Stat
              label={
                shownDetail?.started_at && shownDetail.ended_at
                  ? `${formatClock(shownDetail.started_at)}~${formatClock(shownDetail.ended_at)}`
                  : "时长"
              }
              value={minutes === null ? "—" : formatDurationZh(minutes)}
            />
            <Stat
              label={performedAt ? `${performedAt.getFullYear()}` : ""}
              value={
                performedAt
                  ? `${performedAt.getMonth() + 1}月${performedAt.getDate()}日`
                  : "—"
              }
            />
          </div>
        </header>

        {props.errorMessage ? (
          <StateNotice
            description={props.errorMessage}
            title="训练详情加载失败"
            tone="error"
          />
        ) : null}

        {!shownDetail && !props.errorMessage ? <DetailSkeleton /> : null}

        {groups.map((group, groupIndex) => (
          <section
            key={group.exerciseId}
            style={{
              ...groupStyle(theme),
              animation: reducedMotion
                ? undefined
                : `fmDetailIn ${MOTION.enterMs}ms ${MOTION.easeOut} ${Math.min(groupIndex, 8) * 40}ms both`,
            }}
          >
            <span aria-hidden="true" style={thumbStyle(theme, partColor)}>
              {group.exerciseName.slice(0, 1)}
            </span>
            <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
              <div>
                <h3 style={exerciseNameStyle}>{group.exerciseName}</h3>
                <span style={{ color: theme.colors.tx2, fontSize: 13 }}>
                  {Math.round(group.totalVolume).toLocaleString()} 容量
                </span>
              </div>
              <ol style={setListStyle}>
                {group.sets.map((set) => (
                  <li key={set.id} style={setRowStyle(theme, set.is_warmup)}>
                    <span style={setIndexStyle(theme)}>
                      {set.set_index}
                      {set.is_warmup ? "(热)" : ""}
                    </span>
                    <span style={setValueStyle}>
                      {set.weight_kg > 0 ? (
                        <>
                          {formatKg(set.weight_kg)}
                          <small style={unitStyle(theme)}> kg </small>
                          <small style={unitStyle(theme)}>×</small> {set.reps}
                        </>
                      ) : (
                        <>
                          {set.reps}
                          <small style={unitStyle(theme)}> 次</small>
                        </>
                      )}
                    </span>
                    {set.rpe !== null ? (
                      <span style={effortStyle(theme, set.rpe)}>
                        RPE {set.rpe}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ))}
      </div>
    </SlideUpPage>
  );
}

const DETAIL_KEYFRAMES = `@keyframes fmDetailIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fmSkeleton {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}`;

function Stat(props: { label: string; unit?: string; value: string }) {
  const { theme } = useTheme();

  return (
    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
      <span style={statValueStyle}>
        {props.value}
        {props.unit ? (
          <small style={{ ...unitStyle(theme), fontSize: 12 }}>
            {props.unit}
          </small>
        ) : null}
      </span>
      <span style={statLabelStyle(theme)}>{props.label}</span>
    </div>
  );
}

function DetailSkeleton() {
  const { theme } = useTheme();

  return (
    <div
      aria-label="正在加载训练详情"
      role="status"
      style={{ display: "grid", gap: 14 }}
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            animation: `fmSkeleton 1.2s ease-in-out ${index * 120}ms infinite`,
            background: theme.colors.surf2,
            borderRadius: 16,
            height: 120,
          }}
        />
      ))}
    </div>
  );
}

function topBarStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.surf,
    borderBottom: `1px solid ${theme.colors.divider}`,
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 12px",
  };
}

function closeButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    borderRadius: 12,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "inline-flex",
    height: 40,
    justifyContent: "center",
    width: 40,
  };
}

function grabberStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.grab,
    borderRadius: 999,
    height: 5,
    width: 38,
  };
}

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.4px",
  lineHeight: 1.25,
  margin: 0,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const sessionTabsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

function sessionTabStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    background: isActive ? theme.colors.ac : theme.colors.surf2,
    border: `1px solid ${isActive ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 999,
    color: isActive ? theme.colors.acText : theme.colors.tx2,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 12px",
    transition: "background 180ms ease, color 180ms ease",
  };
}

const statRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "1fr 0.7fr 1.3fr 1fr",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 17,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  letterSpacing: "-0.3px",
  whiteSpace: "nowrap",
};

function statLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };
}

function groupStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderTop: `1px solid ${theme.colors.divider}`,
    display: "grid",
    gap: 14,
    gridTemplateColumns: "52px minmax(0, 1fr)",
    paddingTop: 16,
  };
}

function thumbStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  color: string,
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.isDark ? "#f2f2f2" : theme.colors.surf2,
    border: `3px solid ${color}`,
    borderRadius: "50%",
    color: "#1c1c1e",
    display: "flex",
    fontSize: 18,
    fontWeight: 800,
    height: 52,
    justifyContent: "center",
    width: 52,
  };
}

const exerciseNameStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  margin: 0,
};

const setListStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

function setRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isWarmup: boolean,
): React.CSSProperties {
  return {
    alignItems: "baseline",
    color: isWarmup ? theme.colors.tx3 : theme.colors.tx,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "48px minmax(0, 1fr) auto",
    minHeight: 32,
  };
}

function setIndexStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  };
}

const setValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 500,
};

function unitStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 13, fontWeight: 500 };
}

function effortStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  rpe: number,
): React.CSSProperties {
  const color =
    rpe >= 9
      ? theme.colors.red
      : rpe >= 8
        ? theme.colors.orange
        : theme.colors.green;

  return { color, fontSize: 11, fontWeight: 700 };
}

function footerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.surf,
    borderTop: `1px solid ${theme.colors.divider}`,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "2fr 1fr",
    padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
  };
}

function primaryButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.ac,
    border: "none",
    borderRadius: 14,
    color: theme.colors.acText,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
    minHeight: 48,
  };
}

function secondaryButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 14,
    color: theme.colors.red,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    minHeight: 48,
  };
}
