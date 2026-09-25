import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useTheme } from "../theme/ThemeContext";
import { presenceTransition, usePresence } from "./motion";

export interface SlideUpPageProps {
  /** Accessible name of the page. */
  ariaLabel: string;
  children: React.ReactNode;
  /** Pinned under the scroll area (e.g. an action bar). */
  footer?: React.ReactNode | undefined;
  /** Pinned above the scroll area. */
  header?: React.ReactNode | undefined;
  onClose: () => void;
  open: boolean;
  /**
   * `sheet` leaves a strip of the page underneath visible and rounds the top,
   * like an iOS page sheet; `full` covers the whole viewport.
   */
  variant?: "sheet" | "full" | undefined;
  /** Stacking order; later pages opened on top of earlier ones go higher. */
  zIndex?: number | undefined;
}

/**
 * A page that slides up from the bottom over the current screen and slides
 * back down on close, with the backdrop fading in step.
 *
 * Stays mounted through the exit animation, locks page scroll while open, and
 * closes on Escape.
 *
 * @param props - Content slots, open state and close handler
 * @returns Portal-mounted page, or null once fully closed
 */
export function SlideUpPage(props: SlideUpPageProps) {
  const { theme } = useTheme();
  const presence = usePresence(props.open);
  const variant = props.variant ?? "sheet";
  const { onClose, open } = props;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!presence.isMounted) {
    return null;
  }

  return createPortal(
    <div style={{ inset: 0, position: "fixed", zIndex: props.zIndex ?? 1000 }}>
      <div
        aria-hidden="true"
        onClick={props.onClose}
        style={{
          background: theme.isDark ? "rgba(0,0,0,0.6)" : "rgba(12,16,24,0.36)",
          inset: 0,
          opacity: presence.isVisible ? 1 : 0,
          position: "absolute",
          transition: presenceTransition(presence, ["opacity"]),
        }}
      />
      <section
        aria-label={props.ariaLabel}
        aria-modal="true"
        role="dialog"
        style={{
          background: theme.colors.bg,
          borderRadius: variant === "sheet" ? "20px 20px 0 0" : 0,
          bottom: 0,
          boxShadow: "0 -12px 32px rgba(0,0,0,0.35)",
          color: theme.colors.tx,
          display: "flex",
          flexDirection: "column",
          left: "50%",
          maxWidth: 430,
          overflow: "hidden",
          position: "absolute",
          top:
            variant === "sheet"
              ? "max(28px, env(safe-area-inset-top, 0px))"
              : 0,
          transform: `translate(-50%, ${presence.isVisible ? "0" : "100%"})`,
          transition: presenceTransition(presence, ["transform"]),
          width: "100%",
          willChange: "transform",
        }}
      >
        {props.header ? (
          <div style={{ flex: "0 0 auto" }}>{props.header}</div>
        ) : null}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {props.children}
        </div>
        {props.footer ? (
          <div style={{ flex: "0 0 auto" }}>{props.footer}</div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
