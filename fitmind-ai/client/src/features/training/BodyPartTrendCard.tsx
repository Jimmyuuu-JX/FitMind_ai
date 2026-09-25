import { Card } from "../../components/Card";
import { MiniBarChart } from "../../components/MiniBarChart";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { BODY_PARTS, getBodyPartColor, type BodyPart } from "./body-part";
import {
  compareCompletedWeeks,
  formatChangeRatio,
  type WeeklyTrendPoint,
} from "./weekly-trend-model";

export interface BodyPartTrendCardProps {
  errorMessage: string | null;
  isLoading: boolean;
  points: WeeklyTrendPoint[] | null;
}

/** Weeks per small chart; more would not leave room for the value labels. */
const TILE_WEEKS = 6;

/**
 * Analysis tab's 部位周容量: one small chart per body part, so a part that has
 * been skipped for weeks stands out without reading a table.
 *
 * Uses weighted volume rather than set counts because weighted volume adds up
 * across a part's muscles without counting one set twice.
 *
 * @param props - Weekly points and their loading state
 * @returns Small-multiples card element
 */
export function BodyPartTrendCard(props: BodyPartTrendCardProps) {
  const { theme } = useTheme();
  const points = (props.points ?? []).slice(-TILE_WEEKS);
  const parts = BODY_PARTS.filter((part) =>
    points.some((point) => point.partVolumes[part] > 0),
  );

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={headerRowStyle}>
          <h3 style={titleStyle}>部位周容量</h3>
          <span style={eyebrowStyle(theme)}>近 {TILE_WEEKS} 周 · 加权口径</span>
        </div>

        {props.errorMessage ? (
          <StateNotice
            description="请确认登录状态有效，或稍后重试。"
            icon="chart"
            title="部位趋势加载失败"
            tone="error"
          />
        ) : null}

        {props.isLoading && !props.points ? (
          <p style={copyStyle(theme)}>正在加载部位趋势...</p>
        ) : null}

        {props.points && parts.length === 0 ? (
          <p style={copyStyle(theme)}>
            近 {TILE_WEEKS} 周还没有可按部位统计的训练。
          </p>
        ) : null}

        {parts.length > 0 ? (
          <div style={gridStyle}>
            {parts.map((part) => (
              <PartTile key={part} part={part} points={points} />
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PartTile(props: { part: BodyPart; points: WeeklyTrendPoint[] }) {
  const { theme } = useTheme();
  const { part, points } = props;
  const color = getBodyPartColor(theme, part);
  const change = compareCompletedWeeks(points, (p) => p.partVolumes[part]);
  const lastCompleted = change?.current ?? 0;

  return (
    <div style={tileStyle(theme)}>
      <div style={tileHeaderStyle}>
        <span style={tileNameStyle}>
          <span style={swatchStyle(color)} />
          {part}
        </span>
        <span
          style={{
            color: lastCompleted === 0 ? theme.colors.orange : theme.colors.tx2,
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
          }}
          title="上周与前一周相比"
        >
          {lastCompleted === 0
            ? "上周未练"
            : `上周 ${formatChangeRatio(change?.ratio ?? null)}`}
        </span>
      </div>
      <MiniBarChart
        ariaLabel={`${part}近 ${points.length} 周加权容量：${points.map((p) => `${p.label} ${Math.round(p.partVolumes[part])} 公斤`).join("，")}`}
        bars={points.map((point) => ({
          highlight: point.isCurrentWeek,
          key: point.range.start_date,
          label: point.isCurrentWeek ? "本周" : undefined,
          value: point.partVolumes[part],
        }))}
        formatValue={(value) => (value > 0 ? formatTileKg(value) : "0")}
        height={66}
        highlightColor={color}
        showValues
      />
    </div>
  );
}

/** Tiles are ~20px per bar, so drop the decimal once a value reaches 10k. */
function formatTileKg(kilograms: number): string {
  if (kilograms >= 10000) {
    return `${Math.round(kilograms / 1000)}k`;
  }

  if (kilograms >= 1000) {
    return `${(kilograms / 1000).toFixed(1)}k`;
  }

  return `${Math.round(kilograms)}`;
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

function tileStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 8,
    minWidth: 0,
    padding: "10px 10px 8px",
  };
}

const tileHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 6,
  justifyContent: "space-between",
};

const tileNameStyle: React.CSSProperties = {
  alignItems: "center",
  display: "inline-flex",
  fontSize: 15,
  fontWeight: 800,
  gap: 6,
};

function swatchStyle(color: string): React.CSSProperties {
  return {
    background: color,
    borderRadius: 3,
    display: "inline-block",
    height: 10,
    width: 10,
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}
