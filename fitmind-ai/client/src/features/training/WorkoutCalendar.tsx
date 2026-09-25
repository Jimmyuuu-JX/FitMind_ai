import { useEffect, useMemo, useRef, useState } from "react";

import type { WorkoutSummaryDto } from "../../../../shared/src/training";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";
import { getMenstrualOverview } from "../profile/personal-tools-api";
import { BODY_PARTS, getBodyPartColor, type BodyPart } from "./body-part";
import {
  calculateWorkoutVolume,
  formatAccessibleCalendarVolume,
  formatCalendarVolume,
  summarizeWorkoutCalendarDays,
  summarizeWorkoutMonth,
  toWorkoutLocalDateKey,
  type WorkoutCalendarDaySummary,
} from "./workout-calendar-model";
import { getWorkoutDetail } from "./workout-api";

export interface WorkoutCalendarProps {
  workouts: WorkoutSummaryDto[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  token: string | null;
  /** Whether the server has older pages than the ones loaded. */
  hasMoreWorkouts?: boolean | undefined;
  isLoadingMoreWorkouts?: boolean | undefined;
  /** Fetches the next older page; called until the viewed month is covered. */
  onLoadMoreWorkouts?: (() => Promise<void>) | undefined;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABELS = [
  "1 月",
  "2 月",
  "3 月",
  "4 月",
  "5 月",
  "6 月",
  "7 月",
  "8 月",
  "9 月",
  "10 月",
  "11 月",
  "12 月",
];

/**
 * Month calendar that previews each training day's volume and workout notes.
 *
 * Weeks start on Sunday, matching the assistant's "本周" convention. Tapping a
 * day that has records selects it; tapping it again clears the selection. Days
 * without records are inert.
 *
 * @param props - Workouts to mark, the selected day, and its change handler
 * @returns The month grid with previous/next navigation
 */
export function WorkoutCalendar(props: WorkoutCalendarProps) {
  const { theme } = useTheme();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [fallbackVolumes, setFallbackVolumes] = useState<
    Record<string, number>
  >({});
  const [periodDates, setPeriodDates] = useState<string[]>([]);
  const isMountedRef = useRef(true);
  const pendingVolumeIdsRef = useRef(new Set<string>());
  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const visibleDateKeys = useMemo(
    () => new Set(cells.map((cell) => cell.key)),
    [cells],
  );
  const calendarWorkouts = useMemo(
    () =>
      props.workouts.map((workout) => {
        if (workout.total_volume !== undefined) {
          return workout;
        }

        const fallbackVolume = fallbackVolumes[workout.id];
        return fallbackVolume === undefined
          ? workout
          : { ...workout, total_volume: fallbackVolume };
      }),
    [fallbackVolumes, props.workouts],
  );

  const workoutDays = useMemo(
    () => summarizeWorkoutCalendarDays(calendarWorkouts),
    [calendarWorkouts],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!props.token) {
      return;
    }

    const missingVisibleWorkouts = props.workouts.filter(
      (workout) =>
        workout.total_volume === undefined &&
        fallbackVolumes[workout.id] === undefined &&
        !pendingVolumeIdsRef.current.has(workout.id) &&
        visibleDateKeys.has(
          toWorkoutLocalDateKey(new Date(workout.performed_at)),
        ),
    );

    for (const workout of missingVisibleWorkouts) {
      pendingVolumeIdsRef.current.add(workout.id);
      void getWorkoutDetail(props.token, workout.id)
        .then((detail) => {
          if (isMountedRef.current) {
            setFallbackVolumes((current) => ({
              ...current,
              [workout.id]: calculateWorkoutVolume(detail),
            }));
          }
        })
        .catch(() => {
          // Keep the honest unavailable marker if an older API detail fails.
        })
        .finally(() => {
          pendingVolumeIdsRef.current.delete(workout.id);
        });
    }
  }, [fallbackVolumes, props.token, props.workouts, visibleDateKeys]);

  const { hasMoreWorkouts, isLoadingMoreWorkouts, onLoadMoreWorkouts } = props;
  const lastAutoLoadKeyRef = useRef<string | null>(null);

  // The list is cursor-paged newest first, so an older month may not be loaded
  // yet. Pull pages until the loaded range reaches back past the month start;
  // otherwise the grid would silently show a busy month as empty.
  useEffect(() => {
    if (
      !onLoadMoreWorkouts ||
      !hasMoreWorkouts ||
      isLoadingMoreWorkouts ||
      isMonthFullyLoaded(viewMonth, props.workouts, true)
    ) {
      return;
    }

    // One attempt per (month, loaded count): a failed page leaves the count
    // unchanged, and retrying it on every render would hammer the API.
    const attemptKey = `${viewMonth.getTime()}:${props.workouts.length}`;

    if (lastAutoLoadKeyRef.current === attemptKey) {
      return;
    }

    lastAutoLoadKeyRef.current = attemptKey;
    void onLoadMoreWorkouts();
  }, [
    hasMoreWorkouts,
    isLoadingMoreWorkouts,
    onLoadMoreWorkouts,
    props.workouts,
    viewMonth,
  ]);

  useEffect(() => {
    if (!props.token) {
      return;
    }

    let active = true;
    const month = `${viewMonth.getFullYear()}-${`${viewMonth.getMonth() + 1}`.padStart(2, "0")}`;
    void getMenstrualOverview(props.token, month)
      .then((overview) => {
        if (active) {
          setPeriodDates(overview.showInHistory ? overview.dates : []);
        }
      })
      .catch(() => {
        if (active) setPeriodDates([]);
      });

    return () => {
      active = false;
    };
  }, [props.token, viewMonth]);

  const todayKey = toWorkoutLocalDateKey(new Date());
  const monthLabel = `${viewMonth.getFullYear()} 年 ${viewMonth.getMonth() + 1} 月`;
  const yearOptions = buildYearOptions(viewMonth, props.workouts);
  const isMonthCovered = isMonthFullyLoaded(
    viewMonth,
    props.workouts,
    props.hasMoreWorkouts ?? false,
  );
  const monthSummary = summarizeWorkoutMonth(
    calendarWorkouts,
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
  );
  const monthParts = collectMonthParts(workoutDays, viewMonth);

  return (
    <div data-testid="workout-calendar" style={{ display: "grid", gap: 12 }}>
      <ActionSheet
        description="选择要查看的年份和月份。"
        footer={
          <Button
            onClick={() => {
              goToMonth(startOfMonth(new Date()));
              setIsMonthPickerOpen(false);
            }}
            type="button"
            variant="secondary"
          >
            回到本月
          </Button>
        }
        onClose={() => setIsMonthPickerOpen(false)}
        open={isMonthPickerOpen}
        showCloseButton
        title="选择时间范围"
      >
        <label style={pickerFieldStyle(theme)}>
          <span>年份</span>
          <select
            aria-label="选择年份"
            onChange={(event) => setPickerYear(Number(event.target.value))}
            style={yearSelectStyle(theme)}
            value={pickerYear}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year} 年
              </option>
            ))}
          </select>
        </label>
        <div aria-label="选择月份" role="group" style={monthGridStyle}>
          {MONTH_LABELS.map((label, monthIndex) => {
            const isActive =
              pickerYear === viewMonth.getFullYear() &&
              monthIndex === viewMonth.getMonth();
            return (
              <button
                aria-pressed={isActive}
                key={label}
                onClick={() => {
                  goToMonth(new Date(pickerYear, monthIndex, 1));
                  setIsMonthPickerOpen(false);
                }}
                style={monthOptionStyle(theme, isActive)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </ActionSheet>

      <div style={navRowStyle}>
        <button
          aria-expanded={isMonthPickerOpen}
          aria-haspopup="dialog"
          aria-label={`选择时间范围，当前 ${monthLabel}`}
          onClick={() => {
            setPickerYear(viewMonth.getFullYear());
            setIsMonthPickerOpen(true);
          }}
          style={monthTriggerStyle(theme)}
          type="button"
        >
          <span style={yearLabelStyle(theme)}>{viewMonth.getFullYear()}</span>
          <span style={monthTriggerLabelStyle}>
            <strong style={monthLabelStyle}>
              {viewMonth.getMonth() + 1}月
            </strong>
            <Icon name="chevron-down" size={14} />
          </span>
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            aria-label="上个月"
            onClick={() => goToMonth(addMonths(viewMonth, -1))}
            style={navButtonStyle(theme)}
            type="button"
          >
            ‹
          </button>
          <button
            aria-label="下个月"
            onClick={() => goToMonth(addMonths(viewMonth, 1))}
            style={navButtonStyle(theme)}
            type="button"
          >
            ›
          </button>
        </div>
      </div>

      <div
        aria-live="polite"
        data-testid="workout-calendar-month-summary"
        style={monthSummaryStyle(theme)}
      >
        {isMonthCovered ? (
          <>
            <MonthStat
              label="训练"
              unit="天"
              value={`${monthSummary.trainingDays}`}
            />
            <MonthStat
              label="总容量"
              unit="吨"
              value={
                monthSummary.totalVolume === null
                  ? "—"
                  : formatTonnes(monthSummary.totalVolume)
              }
            />
            <MonthStat
              label="时长"
              unit="小时"
              value={formatHours(monthSummary.totalMinutes)}
            />
          </>
        ) : (
          <span style={{ color: theme.colors.tx3, fontSize: 12 }}>
            {isLoadingMoreWorkouts
              ? "正在加载本月训练…"
              : "本月记录暂未加载完整，可切换月份或刷新重试"}
          </span>
        )}
      </div>

      <div
        data-testid="workout-calendar-grid"
        style={{ display: "grid", gap: 4 }}
      >
        <div style={weekdayRowStyle(theme)}>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} style={weekdayStyle(theme)}>
              {label}
            </span>
          ))}
        </div>
        <div style={rowGridStyle}>
          {cells.map((cell) => {
            const daySummary = workoutDays.get(cell.key);
            const hasWorkout = daySummary !== undefined;
            const isSelected = props.selectedDate === cell.key;
            const isToday = cell.key === todayKey;
            const isPeriod = periodDates.includes(cell.key);
            const accessibleSummary = daySummary
              ? `，${daySummary.workoutCount} 次训练，总容量 ${formatAccessibleCalendarVolume(daySummary.totalVolume)}，备注 ${daySummary.notes.join("；")}`
              : "";

            return (
              <button
                aria-label={`${cell.day} 日${accessibleSummary}${isPeriod ? "，经期" : ""}`}
                aria-pressed={isSelected}
                disabled={!hasWorkout}
                key={cell.key}
                onClick={() => props.onSelectDate(isSelected ? null : cell.key)}
                style={dayCellStyle(theme, {
                  hasWorkout,
                  isCurrentMonth: cell.isCurrentMonth,
                  isSelected,
                })}
                type="button"
              >
                <span style={dayNumberStyle(theme, isToday)}>{cell.day}</span>
                {isPeriod ? (
                  <span aria-hidden="true" style={periodMarkStyle(theme)} />
                ) : null}
                {daySummary ? (
                  <>
                    <span style={volumeBadgeStyle(theme)}>
                      {formatCalendarVolume(daySummary.totalVolume)}
                    </span>
                    {daySummary.notes.map((note, noteIndex) => (
                      <span
                        key={`${cell.key}-${noteIndex}`}
                        style={noteTagStyle(
                          theme,
                          daySummary.parts[noteIndex] ?? null,
                          daySummary.notes.length > 1,
                        )}
                        title={note}
                      >
                        {note}
                      </span>
                    ))}
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {monthParts.length > 0 ? (
        <div aria-hidden="true" style={legendStyle(theme)}>
          <span style={legendItemStyle}>
            <span style={legendSwatchStyle(theme.colors.ac)} />
            当日容量 kg
          </span>
          {monthParts.map((part) => (
            <span key={part} style={legendItemStyle}>
              <span style={legendSwatchStyle(getBodyPartColor(theme, part))} />
              {part}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );

  function goToMonth(nextMonth: Date): void {
    const normalizedMonth = startOfMonth(nextMonth);
    setViewMonth(normalizedMonth);
    const selectedMonthPrefix = `${normalizedMonth.getFullYear()}-${`${normalizedMonth.getMonth() + 1}`.padStart(2, "0")}`;
    if (
      props.selectedDate !== null &&
      !props.selectedDate.startsWith(selectedMonthPrefix)
    ) {
      props.onSelectDate(null);
    }
  }
}

interface DayCell {
  day: number;
  isCurrentMonth: boolean;
  key: string;
}

function buildMonthCells(monthStart: Date): DayCell[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const leadingBlanks = monthStart.getDay();
  const gridStart = new Date(year, month, 1 - leadingBlanks);
  const cells: DayCell[] = [];

  const usedCells = leadingBlanks + daysInMonth(monthStart);
  const cellCount = Math.ceil(usedCells / 7) * 7;

  for (let index = 0; index < cellCount; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    cells.push({
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      key: toWorkoutLocalDateKey(date),
    });
  }

  return cells;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function buildYearOptions(
  viewMonth: Date,
  workouts: WorkoutSummaryDto[],
): number[] {
  const currentYear = new Date().getFullYear();
  const workoutYears = workouts
    .map((workout) => new Date(workout.performed_at).getFullYear())
    .filter(Number.isFinite);
  const minimum = Math.min(
    currentYear - 10,
    viewMonth.getFullYear(),
    ...workoutYears,
  );
  const maximum = Math.max(
    currentYear + 10,
    viewMonth.getFullYear(),
    ...workoutYears,
  );
  return Array.from(
    { length: maximum - minimum + 1 },
    (_, index) => maximum - index,
  );
}

function daysInMonth(monthStart: Date): number {
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
}

/**
 * Whether every workout in the month is among the loaded ones.
 *
 * Pages arrive newest first, so the month is covered once the oldest loaded
 * workout predates the month start, or when the server has no more pages.
 */
function isMonthFullyLoaded(
  monthStart: Date,
  workouts: WorkoutSummaryDto[],
  hasMoreWorkouts: boolean,
): boolean {
  if (!hasMoreWorkouts) {
    return true;
  }

  const oldest = workouts.reduce<number>(
    (min, workout) => Math.min(min, new Date(workout.performed_at).getTime()),
    Number.POSITIVE_INFINITY,
  );

  return oldest < monthStart.getTime();
}

/** Body parts trained this month, in the fixed legend order. */
function collectMonthParts(
  days: Map<string, WorkoutCalendarDaySummary>,
  monthStart: Date,
): BodyPart[] {
  const prefix = toWorkoutLocalDateKey(monthStart).slice(0, 7);
  const seen = new Set<BodyPart>();

  for (const [key, day] of days) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    for (const part of day.parts) {
      if (part) {
        seen.add(part);
      }
    }
  }

  return BODY_PARTS.filter((part) => seen.has(part));
}

function formatTonnes(kilograms: number): string {
  const tonnes = kilograms / 1000;
  return tonnes >= 100 ? `${Math.round(tonnes)}` : tonnes.toFixed(1);
}

function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

interface MonthStatProps {
  label: string;
  unit: string;
  value: string;
}

function MonthStat(props: MonthStatProps) {
  const { theme } = useTheme();

  return (
    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
      <span style={{ color: theme.colors.tx3, fontSize: 11 }}>
        {props.label}
      </span>
      <span style={{ alignItems: "baseline", display: "flex", gap: 3 }}>
        <strong
          style={{
            fontSize: 20,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 800,
            letterSpacing: "-0.4px",
          }}
        >
          {props.value}
        </strong>
        <span style={{ color: theme.colors.tx3, fontSize: 11 }}>
          {props.unit}
        </span>
      </span>
    </span>
  );
}

const navRowStyle: React.CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

function monthTriggerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "grid",
    justifyItems: "start",
    minWidth: 0,
    padding: 0,
    textAlign: "left",
  };
}

function yearLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    lineHeight: 1.2,
  };
}

const monthTriggerLabelStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 4,
};

const monthLabelStyle: React.CSSProperties = {
  fontSize: 28,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  letterSpacing: "-0.6px",
  lineHeight: 1.1,
};

function monthSummaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    minHeight: 58,
    padding: "10px 14px",
  };
}

function pickerFieldStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    fontWeight: 700,
    gap: 7,
  };
}

function yearSelectStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    appearance: "none",
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: theme.colors.tx,
    font: "inherit",
    padding: "11px 12px",
    width: "100%",
  };
}

const monthGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

function monthOptionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    background: isActive ? theme.colors.ac : theme.colors.surf2,
    border: `1px solid ${isActive ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 10,
    color: isActive ? theme.colors.acText : theme.colors.tx,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "11px 6px",
  };
}

function navButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: theme.colors.tx2,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: 18,
    height: 34,
    justifyContent: "center",
    lineHeight: 1,
    width: 34,
  };
}

const rowGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px 3px",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
};

function weekdayRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    ...rowGridStyle,
    borderBottom: `1px solid ${theme.colors.divider}`,
    paddingBottom: 6,
  };
}

function weekdayStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
  };
}

function dayCellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  state: {
    hasWorkout: boolean;
    isCurrentMonth: boolean;
    isSelected: boolean;
  },
): React.CSSProperties {
  return {
    alignItems: "stretch",
    background: state.isSelected ? accentAlpha(theme, 0.12) : "transparent",
    border: `1px solid ${state.isSelected ? theme.colors.ac : "transparent"}`,
    borderRadius: 8,
    color: state.isCurrentMonth ? theme.colors.tx : theme.colors.tx3,
    cursor: state.hasWorkout ? "pointer" : "default",
    display: "flex",
    flexDirection: "column",
    fontVariantNumeric: "tabular-nums",
    gap: 3,
    minHeight: 64,
    minWidth: 0,
    // Adjacent-month days stay readable as context but visibly recede.
    opacity: state.isCurrentMonth ? 1 : 0.4,
    overflow: "hidden",
    padding: "3px 2px 4px",
    transition: "background 0.2s ease, border-color 0.2s ease",
  };
}

function dayNumberStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isToday: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    alignSelf: "center",
    background: isToday ? theme.colors.ac : "transparent",
    borderRadius: theme.radius.capsule,
    color: isToday ? theme.colors.acText : "inherit",
    display: "inline-flex",
    fontSize: 15,
    fontWeight: isToday ? 800 : 500,
    height: 26,
    justifyContent: "center",
    lineHeight: 1,
    width: 26,
  };
}

function periodMarkStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignSelf: "center",
    background: theme.colors.pink,
    borderRadius: 999,
    height: 3,
    width: 14,
  };
}

function volumeBadgeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.ac,
    borderRadius: 4,
    color: theme.colors.acText,
    display: "block",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "-0.2px",
    lineHeight: "15px",
    overflow: "hidden",
    textAlign: "center",
    textOverflow: "clip",
    whiteSpace: "nowrap",
  };
}

/**
 * Session tag colored by its body part. Two lines fit a typical note such as
 * "胸肩训练 1"; with several sessions on one day each tag drops to one line.
 */
function noteTagStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  part: BodyPart | null,
  isCrowded: boolean,
): React.CSSProperties {
  const color = getBodyPartColor(theme, part);
  const lines = isCrowded ? 1 : 2;

  const background = part ? color : theme.colors.surf3;

  return {
    background,
    // Bottom spacing as a border, not padding: a line-clamped box clips at
    // its padding edge, so bottom padding would show a sliver of line three.
    borderBottom: `2px solid ${background}`,
    borderRadius: 4,
    color: part ? (theme.isDark ? "#0f0f0f" : "#ffffff") : theme.colors.tx2,
    display: "-webkit-box",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: "13px",
    overflow: "hidden",
    padding: "2px 3px 0",
    textAlign: "left",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    wordBreak: "break-all",
  };
}

function legendStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 11,
    gap: "4px 12px",
  };
}

const legendItemStyle: React.CSSProperties = {
  alignItems: "center",
  display: "inline-flex",
  gap: 5,
};

function legendSwatchStyle(color: string): React.CSSProperties {
  return {
    background: color,
    borderRadius: 3,
    display: "inline-block",
    height: 8,
    width: 8,
  };
}
