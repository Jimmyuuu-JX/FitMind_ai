import { useEffect, useState } from "react";

import { MOTION, usePrefersReducedMotion } from "../../components/motion";

/**
 * Height animations for the session editor, built on the `grid-template-rows:
 * 0fr ⇄ 1fr` technique so nothing has to be measured.
 *
 * Content is clipped only while it moves; once settled the inner box goes back
 * to `overflow: visible` so the set-completion jelly and focus rings are never
 * cut off at the edges.
 */

export interface TrainingSessionRevealProps {
  children: React.ReactNode;
  /** Collapse and fade out, then call {@link onExited}. */
  isLeaving?: boolean | undefined;
  onExited?: (() => void) | undefined;
  /** Space below the item that collapses with it (use instead of list gap). */
  spacing?: number | undefined;
}

/**
 * Wraps a list item (exercise card, set row, notice) so it grows in on mount
 * and shrinks away before it is removed, instead of popping.
 *
 * @param props - Item content plus leave state and exit callback
 * @returns Animated wrapper
 */
export function TrainingSessionReveal(props: TrainingSessionRevealProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [isEntering, setIsEntering] = useState(!reducedMotion);
  const { isLeaving = false, onExited } = props;

  useEffect(() => {
    if (isLeaving && reducedMotion) {
      onExited?.();
    }
  }, [isLeaving, onExited, reducedMotion]);

  const isClipped = isEntering || isLeaving;

  return (
    <div
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          setIsEntering(false);
        }
      }}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "grid-template-rows" &&
          isLeaving
        ) {
          onExited?.();
        }
      }}
      style={{
        animation: isEntering
          ? `fmreveal ${MOTION.enterMs}ms ${MOTION.easeOut}`
          : "none",
        display: "grid",
        gridTemplateRows: isLeaving ? "0fr" : "1fr",
        opacity: isLeaving ? 0 : 1,
        transition: reducedMotion
          ? "none"
          : `grid-template-rows ${MOTION.exitMs}ms ${MOTION.standard}, opacity ${MOTION.quickMs}ms ${MOTION.easeIn}`,
      }}
    >
      <div
        style={{
          minHeight: 0,
          overflow: isClipped ? "hidden" : "visible",
        }}
      >
        <div style={{ paddingBottom: props.spacing ?? 0 }}>
          {props.children}
        </div>
      </div>
    </div>
  );
}

export interface TrainingSessionAccordionProps {
  children: React.ReactNode;
  id?: string | undefined;
  open: boolean;
}

/**
 * Expand/collapse region for an exercise card. Collapsed content stays
 * mounted (so rows keep their state and only newly added rows animate in) but
 * is inert and hidden from assistive tech.
 *
 * @param props - Open state and body content
 * @returns Animated region
 */
export function TrainingSessionAccordion(props: TrainingSessionAccordionProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [previousOpen, setPreviousOpen] = useState(props.open);
  const [isSettled, setIsSettled] = useState(true);

  if (previousOpen !== props.open) {
    setPreviousOpen(props.open);
    setIsSettled(false);
  }

  const isClipped = !props.open || (!isSettled && !reducedMotion);
  const durationMs = props.open ? MOTION.enterMs : MOTION.exitMs;

  return (
    <div
      aria-hidden={!props.open}
      id={props.id}
      inert={!props.open}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "grid-template-rows"
        ) {
          setIsSettled(true);
        }
      }}
      style={{
        display: "grid",
        gridTemplateRows: props.open ? "1fr" : "0fr",
        opacity: props.open ? 1 : 0,
        transition: reducedMotion
          ? "none"
          : `grid-template-rows ${durationMs}ms ${MOTION.easeOut}, opacity ${durationMs}ms ${props.open ? MOTION.easeOut : MOTION.easeIn}`,
      }}
    >
      <div
        style={{
          minHeight: 0,
          overflow: isClipped ? "hidden" : "visible",
        }}
      >
        {props.children}
      </div>
    </div>
  );
}
