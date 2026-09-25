import { useEffect, useState } from "react";

/**
 * Shared motion tokens.
 *
 * One curve family for the whole app so every surface moves the same way:
 * enter with a fast start and a long soft settle (the iOS sheet curve), exit
 * a little quicker so dismissing never feels like waiting.
 */
export const MOTION = {
  /** Sheets and pages sliding in. */
  enterMs: 320,
  /** Sheets and pages sliding out. */
  exitMs: 220,
  /** Small state changes: tabs, pills, content cross-fades. */
  quickMs: 180,
  easeOut: "cubic-bezier(0.32, 0.72, 0, 1)",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export interface Presence {
  /** Keep the element in the tree (true through the exit animation). */
  isMounted: boolean;
  /** Drive the visual state: false = off-screen/transparent, true = shown. */
  isVisible: boolean;
  /** Duration the current transition should use. */
  durationMs: number;
}

/**
 * Mount/unmount with room for an enter and an exit transition.
 *
 * On open the element mounts in its hidden state and flips to visible on the
 * next frame, so the browser has a start value to transition from. On close
 * it flips to hidden first and unmounts only after the exit finishes.
 *
 * @param open - Whether the surface should be shown
 * @returns Mount and visibility flags plus the active duration
 */
export function usePresence(open: boolean): Presence {
  const reducedMotion = usePrefersReducedMotion();
  const [isMounted, setIsMounted] = useState(open);
  // Always start hidden, even when mounted already open, so a surface that
  // appears together with its parent still plays its enter transition.
  const [isVisible, setIsVisible] = useState(false);

  // Adjust state while rendering when `open` flips (React's documented
  // alternative to a synchronous setState in an effect).
  if (open && !isMounted) {
    setIsMounted(true);
  }

  if (!open && isVisible) {
    setIsVisible(false);
  }

  useEffect(() => {
    if (open) {
      // Two frames: the first commits the hidden styles, the second animates.
      let secondFrame = 0;
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setIsVisible(true));
      });

      return () => {
        cancelAnimationFrame(firstFrame);
        cancelAnimationFrame(secondFrame);
      };
    }

    const timer = window.setTimeout(
      () => setIsMounted(false),
      reducedMotion ? 0 : MOTION.exitMs,
    );

    return () => window.clearTimeout(timer);
  }, [open, reducedMotion]);

  return {
    durationMs: reducedMotion ? 0 : open ? MOTION.enterMs : MOTION.exitMs,
    isMounted,
    isVisible,
  };
}

/**
 * Tracks the user's reduced-motion preference.
 *
 * @returns True when the OS asks for reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => readReducedMotion());

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function readReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Transition string for a surface driven by {@link usePresence}.
 *
 * @param presence - Current presence state
 * @param properties - CSS properties that animate
 * @returns CSS `transition` value
 */
export function presenceTransition(
  presence: Presence,
  properties: string[] = ["transform", "opacity"],
): string {
  const easing = presence.isVisible ? MOTION.easeOut : MOTION.easeIn;

  return properties
    .map((property) => `${property} ${presence.durationMs}ms ${easing}`)
    .join(", ");
}
