import { useTheme } from "../theme/ThemeContext";

export interface MiniBarChartBar {
  key: string;
  /** Axis label under the bar; omit to leave that slot blank. */
  label?: string | undefined;
  value: number;
  /** Draws the bar in the highlight color (e.g. the running week). */
  highlight?: boolean | undefined;
}

export interface MiniBarChartProps {
  /** Accessible summary of what the chart shows. */
  ariaLabel: string;
  /** Optional reference value drawn as a dashed line (e.g. a mean). */
  averageValue?: number | null | undefined;
  bars: MiniBarChartBar[];
  /** Fill for regular bars; defaults to the theme's inactive bar tone. */
  color?: string | undefined;
  formatValue?: ((value: number) => string) | undefined;
  /** Plot height in px, excluding the axis labels. */
  height?: number | undefined;
  highlightColor?: string | undefined;
  /** Print each bar's value above it. */
  showValues?: boolean | undefined;
}

/** Room reserved above the tallest bar for its value label. */
const VALUE_LABEL_SPACE = 14;
/** Keeps a small non-zero week visible next to a much bigger one. */
const MIN_VISIBLE_BAR_PX = 3;

/**
 * Compact column chart for short series (weeks, sessions).
 *
 * Bars are sized in pixels against the series peak, so the chart needs no
 * axis ticks: values ride on the bars when `showValues` is set, and a dashed
 * line marks `averageValue` when given.
 *
 * @param props - Series, colors, and display options
 * @returns Chart element
 */
export function MiniBarChart(props: MiniBarChartProps) {
  const { theme } = useTheme();
  const height = props.height ?? 96;
  const plotHeight = height - (props.showValues ? VALUE_LABEL_SPACE : 0);
  const peak = Math.max(
    0,
    props.averageValue ?? 0,
    ...props.bars.map((bar) => bar.value),
  );
  const format = props.formatValue ?? ((value: number) => `${value}`);
  const hasLabels = props.bars.some((bar) => bar.label);
  const columns = `repeat(${props.bars.length}, minmax(0, 1fr))`;
  const averageOffset =
    props.averageValue && peak > 0
      ? (props.averageValue / peak) * plotHeight
      : null;

  return (
    <div
      aria-label={props.ariaLabel}
      role="img"
      style={{ display: "grid", gap: 6 }}
    >
      <div
        style={{
          display: "grid",
          gap: 4,
          gridTemplateColumns: columns,
          height,
          position: "relative",
        }}
      >
        {averageOffset !== null ? (
          <span
            aria-hidden="true"
            style={{
              borderTop: `1px dashed ${theme.colors.tx2}`,
              bottom: averageOffset,
              left: 0,
              opacity: 0.7,
              pointerEvents: "none",
              position: "absolute",
              right: 0,
            }}
          />
        ) : null}
        {props.bars.map((bar) => {
          const barHeight =
            peak > 0 && bar.value > 0
              ? Math.max((bar.value / peak) * plotHeight, MIN_VISIBLE_BAR_PX)
              : 0;
          const fill = bar.highlight
            ? (props.highlightColor ?? theme.colors.ac)
            : (props.color ?? theme.colors.bar);

          return (
            <div
              key={bar.key}
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                minWidth: 0,
              }}
            >
              {props.showValues ? (
                <span
                  style={{
                    color: bar.highlight ? theme.colors.tx : theme.colors.tx2,
                    fontSize: 9,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: bar.highlight ? 800 : 600,
                    lineHeight: `${VALUE_LABEL_SPACE}px`,
                    maxWidth: "100%",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {format(bar.value)}
                </span>
              ) : null}
              <span
                style={{
                  background: fill,
                  borderRadius: "4px 4px 2px 2px",
                  display: "block",
                  height: barHeight,
                  maxWidth: 26,
                  transition: "height 0.5s cubic-bezier(0.65, 0, 0.35, 1)",
                  width: "72%",
                }}
              />
            </div>
          );
        })}
      </div>
      {hasLabels ? (
        <div style={{ display: "grid", gap: 4, gridTemplateColumns: columns }}>
          {props.bars.map((bar) => (
            <span
              key={bar.key}
              style={{
                color: bar.highlight ? theme.colors.tx : theme.colors.tx3,
                fontSize: 9,
                fontVariantNumeric: "tabular-nums",
                fontWeight: bar.highlight ? 700 : 500,
                overflow: "visible",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {bar.label ?? ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
