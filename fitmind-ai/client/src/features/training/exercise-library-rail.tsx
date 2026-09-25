import { MOTION } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import type { LibraryPart, LibraryRailEntry } from "./exercise-library-model";

export interface ExerciseLibraryRailProps {
  activePart: LibraryPart;
  activeSub: string | null;
  entries: LibraryRailEntry[];
  /** While searching, the rail shows no active item. */
  isSearching: boolean;
  onSelect: (part: LibraryPart, sub: string | null) => void;
  reducedMotion: boolean;
}

/**
 * Vertical body-part rail. The active part grows an accent bar and unfolds
 * its sub-categories (上胸 / 中下胸 …) underneath.
 *
 * @param props - Rail entries, active selection and change handler
 * @returns Navigation column
 */
export function ExerciseLibraryRail(props: ExerciseLibraryRailProps) {
  const { theme } = useTheme();
  const transition = (properties: string[]) =>
    props.reducedMotion
      ? "none"
      : properties
          .map(
            (property) => `${property} ${MOTION.quickMs}ms ${MOTION.standard}`,
          )
          .join(", ");

  return (
    <nav aria-label="身体部位" style={{ display: "grid", paddingBottom: 24 }}>
      {props.entries.map((entry) => {
        const isActivePart =
          !props.isSearching && entry.part === props.activePart;
        const isPartSelected = isActivePart && props.activeSub === null;
        const isExpanded = isActivePart && entry.subs.length > 0;

        return (
          <div key={entry.part}>
            <button
              aria-pressed={isPartSelected}
              onClick={() => props.onSelect(entry.part, null)}
              style={{
                alignItems: "center",
                background: isActivePart ? theme.colors.soft : "transparent",
                border: "none",
                color: isActivePart ? theme.colors.tx : theme.colors.tx2,
                cursor: "pointer",
                display: "flex",
                fontSize: 15,
                fontWeight: isActivePart ? 700 : 500,
                minHeight: 48,
                padding: "0 8px 0 16px",
                position: "relative",
                textAlign: "left",
                transition: transition(["background-color", "color"]),
                width: "100%",
              }}
              type="button"
            >
              <span
                aria-hidden="true"
                style={{
                  backgroundColor: theme.colors.ac,
                  borderRadius: "0 3px 3px 0",
                  bottom: 10,
                  left: 0,
                  position: "absolute",
                  top: 10,
                  transform: `scaleY(${isActivePart ? 1 : 0})`,
                  transition: transition(["transform"]),
                  width: 4,
                }}
              />
              <span style={{ opacity: entry.count === 0 ? 0.5 : 1 }}>
                {entry.part}
              </span>
            </button>

            {entry.subs.length > 0 ? (
              <div
                aria-hidden={!isExpanded}
                inert={!isExpanded}
                style={{
                  display: "grid",
                  gridTemplateRows: isExpanded ? "1fr" : "0fr",
                  opacity: isExpanded ? 1 : 0,
                  transition: transition(["grid-template-rows", "opacity"]),
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  {entry.subs.map((sub) => {
                    const isActiveSub =
                      isActivePart && props.activeSub === sub.label;

                    return (
                      <button
                        aria-pressed={isActiveSub}
                        key={sub.label}
                        onClick={() => props.onSelect(entry.part, sub.label)}
                        style={{
                          background: "none",
                          border: "none",
                          color: isActiveSub
                            ? theme.colors.ac
                            : theme.colors.tx2,
                          cursor: "pointer",
                          display: "block",
                          fontSize: 13,
                          fontWeight: isActiveSub ? 700 : 500,
                          minHeight: 40,
                          padding: "0 6px 0 26px",
                          textAlign: "left",
                          transition: transition(["color"]),
                          width: "100%",
                        }}
                        type="button"
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
