import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { presenceTransition, usePresence } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";

/** Viewport rect of the trigger (a `DOMRect` from getBoundingClientRect). */
export interface PopoverAnchor {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface PopoverMenuItem {
  disabled?: boolean | undefined;
  icon?: React.ReactNode;
  key: string;
  label: string;
  onSelect: () => void;
  /** Draw a divider above this item (starts a new group). */
  separated?: boolean | undefined;
  tone?: "default" | "danger" | undefined;
}

export interface TrainingSessionPopoverProps {
  /** Which anchor edge the menu lines up with. */
  align?: "start" | "end" | undefined;
  /** Open while non-null; the menu grows out of this rect. */
  anchor: PopoverAnchor | null;
  ariaLabel: string;
  items: PopoverMenuItem[];
  onClose: () => void;
}

const ITEM_HEIGHT = 46;
const EDGE_GAP = 12;
const ANCHOR_GAP = 6;
/** Above the session page (1000) and its notes page (1100). */
const POPOVER_Z_INDEX = 1200;

/**
 * Menu anchored to its trigger (训记's gear / set / ··· menus). Scales and
 * fades out of the trigger's corner, flips above the trigger when there is no
 * room below, dims the page behind it, and closes on outside tap or Escape.
 *
 * @param props - Anchor, items and close handler
 * @returns Portal-mounted menu, or null once fully closed
 */
export function TrainingSessionPopover(props: TrainingSessionPopoverProps) {
  const { theme } = useTheme();
  const isOpen = props.anchor !== null;
  const presence = usePresence(isOpen);
  const [lastAnchor, setLastAnchor] = useState(props.anchor);
  const [lastItems, setLastItems] = useState(props.items);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(props.onClose);

  useEffect(() => {
    onCloseRef.current = props.onClose;
  });

  // Keep the last anchor and items through the exit animation.
  if (props.anchor && props.anchor !== lastAnchor) {
    setLastAnchor(props.anchor);
  }

  if (isOpen && props.items !== lastItems) {
    setLastItems(props.items);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    const onResize = () => onCloseRef.current();
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen]);

  if (!presence.isMounted || !lastAnchor) {
    return null;
  }

  const items = isOpen ? props.items : lastItems;
  const placement = getPlacement(lastAnchor, items.length, props.align);

  return createPortal(
    <div style={{ inset: 0, position: "fixed", zIndex: POPOVER_Z_INDEX }}>
      <div
        aria-hidden="true"
        onClick={props.onClose}
        style={{
          background: theme.colors.sh40,
          inset: 0,
          opacity: presence.isVisible ? 1 : 0,
          position: "absolute",
          transition: presenceTransition(presence, ["opacity"]),
        }}
      />
      <div
        aria-label={props.ariaLabel}
        onKeyDown={(event) => moveFocus(event, menuRef.current)}
        ref={menuRef}
        role="menu"
        style={{
          ...placement.position,
          backgroundColor: theme.isDark
            ? theme.colors.surf3
            : theme.colors.surf,
          border: `1px solid ${theme.colors.bdr2}`,
          borderRadius: 16,
          boxShadow: `0 16px 40px ${theme.colors.sh40}`,
          maxWidth: `calc(100vw - ${EDGE_GAP * 2}px)`,
          minWidth: 196,
          opacity: presence.isVisible ? 1 : 0,
          overflow: "hidden",
          padding: "6px 0",
          position: "absolute",
          transform: presence.isVisible ? "scale(1)" : "scale(0.86)",
          transformOrigin: placement.origin,
          transition: presenceTransition(presence, ["transform", "opacity"]),
        }}
      >
        {items.map((item) => (
          <div key={item.key}>
            {item.separated ? (
              <div
                aria-hidden="true"
                style={{
                  background: theme.colors.bdr2,
                  height: 1,
                  margin: "4px 0",
                }}
              />
            ) : null}
            <button
              disabled={item.disabled}
              onClick={() => {
                props.onClose();
                item.onSelect();
              }}
              role="menuitem"
              style={itemStyle(theme, item.tone ?? "default")}
              type="button"
            >
              {item.icon ? (
                <span style={itemIconStyle(theme, item.tone ?? "default")}>
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function getPlacement(
  anchor: PopoverAnchor,
  itemCount: number,
  align: TrainingSessionPopoverProps["align"] = "end",
): { origin: string; position: React.CSSProperties } {
  const estimatedHeight = itemCount * ITEM_HEIGHT + 12;
  const opensBelow =
    anchor.bottom + ANCHOR_GAP + estimatedHeight + EDGE_GAP <=
      window.innerHeight || anchor.top < window.innerHeight / 2;
  const vertical: React.CSSProperties = opensBelow
    ? {
        top: Math.min(
          anchor.bottom + ANCHOR_GAP,
          Math.max(EDGE_GAP, window.innerHeight - estimatedHeight - EDGE_GAP),
        ),
      }
    : {
        bottom: Math.max(
          EDGE_GAP,
          window.innerHeight - anchor.top + ANCHOR_GAP,
        ),
      };
  const horizontal: React.CSSProperties =
    align === "end"
      ? { right: Math.max(EDGE_GAP, window.innerWidth - anchor.right) }
      : { left: Math.max(EDGE_GAP, anchor.left) };

  return {
    origin: `${align === "end" ? "right" : "left"} ${opensBelow ? "top" : "bottom"}`,
    position: { ...vertical, ...horizontal },
  };
}

function moveFocus(
  event: React.KeyboardEvent<HTMLDivElement>,
  menu: HTMLDivElement | null,
): void {
  if (!menu || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) {
    return;
  }

  event.preventDefault();
  const buttons = Array.from(
    menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  const index = buttons.findIndex(
    (button) => button === document.activeElement,
  );
  const step = event.key === "ArrowDown" ? 1 : -1;
  const next = buttons[(index + step + buttons.length) % buttons.length];
  next?.focus();
}

function itemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  tone: "default" | "danger",
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    color: tone === "danger" ? theme.colors.red : theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    fontSize: 15,
    fontWeight: 600,
    gap: 14,
    minHeight: ITEM_HEIGHT,
    padding: "0 20px",
    textAlign: "left",
    whiteSpace: "nowrap",
    width: "100%",
  };
}

function itemIconStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  tone: "default" | "danger",
): React.CSSProperties {
  return {
    color: tone === "danger" ? theme.colors.red : theme.colors.ac,
    display: "inline-flex",
  };
}
