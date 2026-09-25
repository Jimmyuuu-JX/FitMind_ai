import { Card } from "../../components/Card";
import { MiniBarChart } from "../../components/MiniBarChart";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import {
  averageCompletedWeeks,
  type WeeklyTrendPoint,
} from "./weekly-trend-model";

export interface TrainingOverviewCardProps {
  errorMessage: string | null;
  isLoading: boolean;
  points: WeeklyTrendPoint[] | null;
}

/** Weeks drawn in the session-count sparkline. */
const CHART_WEEKS = 8;

/**
 * Analysis tab's 训练概况: this week's session count next to the recent
 * weekly rhythm, so "am I on track this week" is answered at a glance.
 *
 * @param props - Weekly points and their loading state
 * @returns Overview card element
 */
export function TrainingOverviewCard(props: TrainingOverviewCardProps) {
  const { theme } = useTheme();
  const points = props.points ?? [];
  const current = points[points.length - 1];
  const lastWeek = points[points.length - 2];
  const averageSessions = averageCompletedWeeks(points, (p) => p.workoutCount);
  const chartPoints = points.slice(-CHART_WEEKS);

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={headerRowStyle}>
          <h3 style={titleStyle}>训练概况</h3>
          <span style={eyebrowStyle(theme)}>周起始为周日</span>
        </div>

        {props.errorMessage ? (
          <StateNotice
            description="请确认登录状态有效，或稍后重试。"
            icon="chart"
            title="训练概况加载失败"
            tone="error"
          />
        ) : null}

        {props.isLoading && !props.points ? (
          <p style={copyStyle(theme)}>正在加载训练概况...</p>
        ) : null}

        {current ? (
          <div style={bodyStyle}>
            <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
              <div>
                <div style={bigValueRowStyle}>
                  <strong style={bigValueStyle}>{current.workoutCount}</strong>
                  <span style={unitStyle(theme)}>次</span>
                </div>
                <span style={labelStyle(theme)}>本周训练</span>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <SmallStat
                  label="上周"
                  value={`${lastWeek?.workoutCount ?? 0}`}
                />
                <SmallStat label="周均" value={averageSessions.toFixed(1)} />
              </div>
            </div>
            <MiniBarChart
              ariaLabel={`近 ${chartPoints.length} 周每周训练次数：${chartPoints.map((p) => `${p.label} ${p.workoutCount} 次`).join("，")}`}
              averageValue={averageSessions}
              bars={chartPoints.map((point) => ({
                highlight: point.isCurrentWeek,
                key: point.range.start_date,
                label: point.isCurrentWeek ? "本周" : undefined,
                value: point.workoutCount,
              }))}
              height={84}
              showValues
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function SmallStat(props: { label: string; value: string }) {
  const { theme } = useTheme();

  return (
    <span style={{ display: "grid" }}>
      <span style={{ alignItems: "baseline", display: "flex", gap: 2 }}>
        <strong
          style={{
            fontSize: 17,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 800,
          }}
        >
          {props.value}
        </strong>
        <span style={unitStyle(theme)}>次</span>
      </span>
      <span style={labelStyle(theme)}>{props.label}</span>
    </span>
  );
}

const headerRowStyle: React.CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.2px",
  margin: 0,
};

function eyebrowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11 };
}

const bodyStyle: React.CSSProperties = {
  alignItems: "end",
  display: "grid",
  gap: 14,
  gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.4fr)",
};

const bigValueRowStyle: React.CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  gap: 4,
};

const bigValueStyle: React.CSSProperties = {
  fontSize: 40,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  letterSpacing: "-1px",
  lineHeight: 1,
};

function unitStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 12 };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12 };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}
