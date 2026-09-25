import { Card } from "../../components/Card";
import { MiniBarChart } from "../../components/MiniBarChart";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import {
  averageCompletedWeeks,
  compareCompletedWeeks,
  formatChangeRatio,
  formatCompactKg,
  type WeeklyTrendPoint,
} from "./weekly-trend-model";

export interface WeeklyVolumeCardProps {
  errorMessage: string | null;
  isLoading: boolean;
  points: WeeklyTrendPoint[] | null;
}

/** Every nth week gets an axis date so twelve labels do not collide. */
const LABEL_EVERY = 3;

/**
 * Analysis tab's 每周训练容量: the trailing weeks' volume with the weekly mean
 * drawn across, and last week compared with the week before.
 *
 * The running week is highlighted but kept out of the mean and the
 * comparison — it is partial until Saturday.
 *
 * @param props - Weekly points and their loading state
 * @returns Weekly-volume card element
 */
export function WeeklyVolumeCard(props: WeeklyVolumeCardProps) {
  const { theme } = useTheme();
  const points = props.points ?? [];
  const average = averageCompletedWeeks(points, (p) => p.totalVolume);
  const change = compareCompletedWeeks(points, (p) => p.totalVolume);
  const current = points[points.length - 1];
  const hasVolume = points.some((point) => point.totalVolume > 0);

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={headerRowStyle}>
          <h3 style={titleStyle}>每周训练容量</h3>
          <span style={eyebrowStyle(theme)}>近 {points.length || 12} 周</span>
        </div>

        {props.errorMessage ? (
          <StateNotice
            description="请确认登录状态有效，或稍后重试。"
            icon="chart"
            title="每周容量加载失败"
            tone="error"
          />
        ) : null}

        {props.isLoading && !props.points ? (
          <p style={copyStyle(theme)}>正在加载每周容量...</p>
        ) : null}

        {props.points && !hasVolume ? (
          <p style={copyStyle(theme)}>
            近 {points.length} 周还没有带重量的训练记录。
          </p>
        ) : null}

        {props.points && hasVolume ? (
          <>
            <div style={headlineRowStyle}>
              <div>
                <span style={labelStyle(theme)}>周均容量</span>
                <div
                  style={{ alignItems: "baseline", display: "flex", gap: 3 }}
                >
                  <strong style={bigValueStyle}>
                    {(average / 1000).toFixed(1)}
                  </strong>
                  <span style={unitStyle(theme)}>吨/周</span>
                </div>
              </div>
              {change ? <ChangeBadge ratio={change.ratio} /> : null}
            </div>

            <MiniBarChart
              ariaLabel={`每周训练容量：${points.map((p) => `${p.label} ${Math.round(p.totalVolume)} 公斤`).join("，")}`}
              averageValue={average}
              bars={points.map((point, index) => ({
                highlight: point.isCurrentWeek,
                key: point.range.start_date,
                label:
                  point.isCurrentWeek ||
                  (points.length - 1 - index) % LABEL_EVERY === 0
                    ? point.label
                    : undefined,
                value: point.totalVolume,
              }))}
              formatValue={formatCompactKg}
              height={120}
            />

            <p style={footnoteStyle(theme)}>
              本周至今 {Math.round(current?.totalVolume ?? 0).toLocaleString()}{" "}
              公斤 · 虚线为周均（不含本周）
            </p>
          </>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Last completed week versus the one before it.
 *
 * Volume is not a score, so the badge stays neutral in color rather than
 * praising growth or flagging a deload as bad.
 */
function ChangeBadge(props: { ratio: number | null }) {
  const { theme } = useTheme();

  return (
    <span style={{ display: "grid", justifyItems: "end" }}>
      <strong
        style={{
          fontSize: 17,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 800,
        }}
      >
        {formatChangeRatio(props.ratio)}
      </strong>
      <span style={labelStyle(theme)}>上周 vs 前一周</span>
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

const headlineRowStyle: React.CSSProperties = {
  alignItems: "end",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const bigValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  letterSpacing: "-0.6px",
  lineHeight: 1.1,
};

function unitStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 12 };
}

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 11 };
}

function footnoteStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    borderTop: `1px solid ${theme.colors.divider}`,
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: 0,
    paddingTop: 10,
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}
