import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";

export interface TrainingSessionEmptyStateProps {
  isAddActionEnabled?: boolean | undefined;
  onAddActionClick?: (() => void) | undefined;
}

/**
 * Shown before the first exercise is added.
 *
 * @param props - Optional add-exercise shortcut
 * @returns Empty-state card
 */
export function TrainingSessionEmptyState(
  props: TrainingSessionEmptyStateProps,
) {
  const { theme } = useTheme();
  const canAdd = props.onAddActionClick && props.isAddActionEnabled !== false;

  return (
    <section style={cardStyle(theme)}>
      <span style={iconStyle(theme)}>
        <Icon name="dumbbell" size={22} />
      </span>
      <strong style={{ color: theme.colors.tx, fontSize: 15 }}>
        还没有添加动作
      </strong>
      <p style={copyStyle(theme)}>
        点击下方「加动作」从动作库添加本次训练动作。
      </p>
      {canAdd ? (
        <button
          onClick={props.onAddActionClick}
          style={buttonStyle(theme)}
          type="button"
        >
          <Icon name="plus" size={16} />
          从动作库添加
        </button>
      ) : null}
    </section>
  );
}

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.surf,
    border: `1px dashed ${theme.colors.bdr2}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 10,
    justifyItems: "center",
    padding: "28px 20px",
    textAlign: "center",
  };
}

function iconStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.surf2,
    borderRadius: 999,
    color: theme.colors.tx2,
    display: "flex",
    height: 52,
    justifyContent: "center",
    width: 52,
  };
}

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  };
}

function buttonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.ac,
    border: "none",
    borderRadius: 999,
    color: theme.colors.acText,
    cursor: "pointer",
    display: "flex",
    fontSize: 14,
    fontWeight: 700,
    gap: 6,
    marginTop: 4,
    padding: "10px 18px",
  };
}
