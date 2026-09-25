import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { DictionaryExercise } from "./dictionary-api";

import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { SlideUpPage } from "../../components/SlideUpPage";
import { StateNotice } from "../../components/StateNotice";
import { MOTION, usePrefersReducedMotion } from "../../components/motion";
import { useTheme } from "../../theme/ThemeContext";
import { ExerciseDetailSheet } from "./ExerciseDetailSheet";
import {
  ExerciseLibraryCard,
  ExerciseLibraryCardSkeleton,
} from "./exercise-library-card";
import {
  buildLibrarySections,
  filterLibraryExercises,
  LIBRARY_PARTS,
  listEquipmentGroups,
  listLibraryRail,
  type LibraryPart,
} from "./exercise-library-model";
import { ExerciseLibraryRail } from "./exercise-library-rail";

type Theme = ReturnType<typeof useTheme>["theme"];

export interface ExerciseLibraryScreenProps extends ExercisePickerProps {
  isOpen: boolean;
  /**
   * `add` / `replace` pick an exercise on tap; `browse` only opens its
   * detail. The 讲解 tag opens the detail in every mode.
   */
  mode?: "add" | "replace" | "browse" | undefined;
  onClose: () => void;
  onSelectExercise?: ((exercise: DictionaryExercise) => void) | undefined;
  /** Rail item selected when the library opens. Defaults to 胸. */
  initialPart?: LibraryPart | undefined;
  /** Focus the search field once the page has slid in. */
  autoFocusSearch?: boolean | undefined;
}

const TITLES = {
  add: "添加动作",
  browse: "动作库",
  replace: "替换动作",
} as const;

/**
 * Full-height exercise library modeled on a lifting log's 动作 tab: search on
 * top, a body-part rail on the left, equipment chips, equipment sections of
 * two-column cards, and a quick index on the right edge.
 *
 * Slides up when opened and back down before it reports a close or a pick,
 * so callers that unmount it on close still get the exit animation.
 *
 * @param props - Dictionary state, mode and handlers
 * @returns Portal page, or null once closed
 */
export function ExerciseLibraryScreen(props: ExerciseLibraryScreenProps) {
  const { theme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const {
    exercises,
    isLoadingExercises,
    isOpen,
    mode = "add",
    onClose,
    onSearch,
    onSelectExercise,
    searchError,
    usageCounts,
  } = props;
  const canPick = mode !== "browse" && onSelectExercise !== undefined;

  const [keyword, setKeyword] = useState("");
  const [part, setPart] = useState<LibraryPart>(props.initialPart ?? "胸");
  const [sub, setSub] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [detailExercise, setDetailExercise] =
    useState<DictionaryExercise | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Callers mount this already open; start closed for one frame so the page
  // has somewhere to slide up from.
  const [hasEntered, setHasEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  const exitTimerRef = useRef<number | null>(null);

  if (lastIsOpen !== isOpen) {
    setLastIsOpen(isOpen);
    if (isOpen) {
      setIsClosing(false);
      setChosenId(null);
    }
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasEntered(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const autoFocusSearch = props.autoFocusSearch ?? false;

  useEffect(() => {
    if (!autoFocusSearch) {
      return;
    }

    const timer = window.setTimeout(
      () => searchInputRef.current?.focus({ preventScroll: true }),
      reducedMotion ? 0 : MOTION.enterMs,
    );

    return () => window.clearTimeout(timer);
  }, [autoFocusSearch, reducedMotion]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void onSearch({ muscle: "", q: "" });
  }, [isOpen, onSearch]);

  const exitThen = useCallback(
    (action: () => void) => {
      if (isClosing) {
        return;
      }

      setIsClosing(true);
      setDetailExercise(null);
      exitTimerRef.current = window.setTimeout(
        () => {
          exitTimerRef.current = null;
          action();
        },
        reducedMotion ? 0 : MOTION.exitMs,
      );
    },
    [isClosing, reducedMotion],
  );

  const requestClose = useCallback(
    () => exitThen(onClose),
    [exitThen, onClose],
  );

  const pick = useCallback(
    (exercise: DictionaryExercise) => {
      if (!onSelectExercise) {
        return;
      }

      setChosenId(exercise.id);
      exitThen(() => onSelectExercise(exercise));
    },
    [exitThen, onSelectExercise],
  );

  const isSearching = keyword.trim().length > 0;
  const rail = useMemo(() => listLibraryRail(exercises), [exercises]);
  const scoped = useMemo(
    () => filterLibraryExercises(exercises, { keyword, part, sub }),
    [exercises, keyword, part, sub],
  );
  const equipmentGroups = useMemo(() => listEquipmentGroups(scoped), [scoped]);
  const activeEquipment = equipmentGroups.some(
    (group) => group.key === equipment,
  )
    ? equipment
    : null;
  const sections = useMemo(
    () =>
      buildLibrarySections(scoped, {
        equipment: activeEquipment,
        usageCounts,
      }),
    [activeEquipment, scoped, usageCounts],
  );
  const showIndex = sections.length > 1;

  // --- content transitions -------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const railPosition =
    LIBRARY_PARTS.indexOf(part) * 10 +
    (sub
      ? (rail.find((entry) => entry.part === part)?.subs ?? []).findIndex(
          (item) => item.label === sub,
        ) + 1
      : 0);
  const chipPosition = activeEquipment
    ? equipmentGroups.findIndex((group) => group.key === activeEquipment) + 1
    : 0;
  const contentKey = `${railPosition}|${chipPosition}|${isSearching ? "q" : ""}`;
  const previousRef = useRef({ chipPosition, contentKey, railPosition });

  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { chipPosition, contentKey, railPosition };

    if (previous.contentKey === contentKey) {
      return;
    }

    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }

    const element = contentRef.current;

    if (reducedMotion || !element || typeof element.animate !== "function") {
      return;
    }

    let from = "translate3d(0, 0, 0)";

    if (previous.railPosition !== railPosition) {
      from = `translate3d(0, ${railPosition > previous.railPosition ? 14 : -14}px, 0)`;
    } else if (previous.chipPosition !== chipPosition) {
      from = `translate3d(${chipPosition > previous.chipPosition ? 16 : -16}px, 0, 0)`;
    }

    element.animate(
      [
        { opacity: 0, transform: from },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration: MOTION.quickMs, easing: MOTION.standard },
    );
  }, [chipPosition, contentKey, railPosition, reducedMotion]);

  const updateActiveSection = useCallback(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const ordered = [...sectionRefs.current.entries()].sort(
      (left, right) => left[1].offsetTop - right[1].offsetTop,
    );
    const isAtBottom =
      container.scrollTop > 0 &&
      container.scrollTop + container.clientHeight >=
        container.scrollHeight - 2;
    // Short lists cannot scroll the last heading to the top; once the end is
    // reached, the last section is the one being looked at.
    let current: string | null = isAtBottom
      ? (ordered.at(-1)?.[0] ?? null)
      : (ordered[0]?.[0] ?? null);

    if (!isAtBottom) {
      for (const [key, element] of ordered) {
        if (element.offsetTop <= container.scrollTop + 24) {
          current = key;
        }
      }
    }

    setActiveSection(current);
  }, []);

  const scrollFrameRef = useRef(0);

  function handleContentScroll() {
    cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(updateActiveSection);
  }

  useEffect(() => {
    const frame = requestAnimationFrame(updateActiveSection);

    return () => cancelAnimationFrame(frame);
  }, [sections, updateActiveSection]);

  function jumpToSection(key: string) {
    const container = scrollRef.current;
    const element = sectionRefs.current.get(key);

    if (!container || !element) {
      return;
    }

    container.scrollTo({
      behavior: reducedMotion ? "auto" : "smooth",
      top: element.offsetTop - 4,
    });
  }

  function selectRail(nextPart: LibraryPart, nextSub: string | null) {
    setKeyword("");
    setPart(nextPart);
    setSub(nextSub);
    setEquipment(null);
  }

  function selectEquipment(next: string | null) {
    setEquipment(next);
    chipRefs.current.get(next ?? "all")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }

  function openCard(exercise: DictionaryExercise) {
    if (canPick) {
      pick(exercise);
    } else {
      setDetailExercise(exercise);
    }
  }

  const header = (
    <header style={headerStyle}>
      <span aria-hidden="true" style={grabberStyle(theme)} />
      <div style={headerRowStyle}>
        <h2 style={titleStyle}>{TITLES[canPick ? mode : "browse"]}</h2>
        <IconButton icon="x" label="关闭动作库" onClick={requestClose} />
      </div>
      <label style={searchFieldStyle(theme)}>
        <span aria-hidden="true" style={searchIconStyle(theme)}>
          <Icon name="search" size={16} />
        </span>
        <input
          aria-label="搜索动作名称"
          enterKeyHint="search"
          inputMode="search"
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="输入动作名字搜索"
          ref={searchInputRef}
          style={searchInputStyle(theme)}
          type="text"
          value={keyword}
        />
        {isSearching ? (
          <button
            aria-label="清除搜索"
            onClick={() => setKeyword("")}
            style={clearButtonStyle(theme)}
            type="button"
          >
            <Icon name="x" size={12} />
          </button>
        ) : null}
      </label>
    </header>
  );

  const isFirstLoad = isLoadingExercises && exercises.length === 0;

  return (
    <SlideUpPage
      ariaLabel={TITLES[canPick ? mode : "browse"]}
      header={header}
      onClose={requestClose}
      open={isOpen && hasEntered && !isClosing}
      zIndex={2147483647}
    >
      <div style={bodyGridStyle}>
        <div style={railColumnStyle(theme)}>
          <ExerciseLibraryRail
            activePart={part}
            activeSub={sub}
            entries={rail}
            isSearching={isSearching}
            onSelect={selectRail}
            reducedMotion={reducedMotion}
          />
        </div>

        <div style={mainColumnStyle}>
          <div aria-label="器械筛选" role="group" style={chipRowStyle}>
            {[{ key: "all", label: "全部" }, ...equipmentGroups].map(
              (group) => {
                const value = group.key === "all" ? null : group.key;
                const isActive = value === activeEquipment;

                return (
                  <button
                    aria-pressed={isActive}
                    key={group.key}
                    onClick={() => selectEquipment(value)}
                    ref={(element) => {
                      if (element) {
                        chipRefs.current.set(group.key, element);
                      } else {
                        chipRefs.current.delete(group.key);
                      }
                    }}
                    style={chipStyle(theme, isActive, reducedMotion)}
                    type="button"
                  >
                    {group.label}
                  </button>
                );
              },
            )}
          </div>

          <div style={{ minHeight: 0, position: "relative" }}>
            <div
              onScroll={handleContentScroll}
              ref={scrollRef}
              style={scrollAreaStyle(showIndex)}
            >
              <div ref={contentRef}>
                {searchError ? (
                  <StateNotice
                    description="动作库暂时无法加载，请确认服务已启动，或稍后重试。"
                    icon="search"
                    title="动作库加载失败"
                    tone="error"
                  />
                ) : isFirstLoad ? (
                  <ul aria-label="正在加载动作库" style={gridStyle}>
                    {[0, 1, 2, 3].map((index) => (
                      <ExerciseLibraryCardSkeleton key={index} />
                    ))}
                  </ul>
                ) : sections.length === 0 ? (
                  <StateNotice
                    description={
                      isSearching
                        ? "换个关键词试试，比如动作名或器械。"
                        : "这个分类暂时没有动作，可以直接搜索动作名称。"
                    }
                    icon="search"
                    title="没有找到动作"
                  />
                ) : (
                  <>
                    {isSearching ? (
                      <p style={resultCountStyle(theme)}>
                        找到 {scoped.length} 个动作
                      </p>
                    ) : null}
                    {sections.map((section) => (
                      <section
                        aria-label={section.label}
                        key={section.key}
                        ref={(element) => {
                          if (element) {
                            sectionRefs.current.set(section.key, element);
                          } else {
                            sectionRefs.current.delete(section.key);
                          }
                        }}
                        style={sectionStyle}
                      >
                        <h3 style={sectionTitleStyle(theme)}>
                          {section.label}
                        </h3>
                        <ul style={gridStyle}>
                          {section.exercises.map((exercise) => (
                            <ExerciseLibraryCard
                              exercise={exercise}
                              isChosen={chosenId === exercise.id}
                              key={exercise.id}
                              onOpenDetail={setDetailExercise}
                              onPress={openCard}
                              reducedMotion={reducedMotion}
                              usageCount={usageCounts?.get(exercise.id)}
                            />
                          ))}
                        </ul>
                      </section>
                    ))}
                  </>
                )}
              </div>
            </div>

            {showIndex ? (
              <nav aria-label="快速跳转" style={indexStripStyle}>
                {sections.map((section) => {
                  const isActive = section.key === activeSection;

                  return (
                    <button
                      aria-label={`跳到${section.label}`}
                      key={section.key}
                      onClick={() => jumpToSection(section.key)}
                      style={indexButtonStyle(theme, isActive, reducedMotion)}
                      type="button"
                    >
                      {section.indexLabel}
                    </button>
                  );
                })}
              </nav>
            ) : null}
          </div>
        </div>
      </div>

      <ExerciseDetailSheet
        actionLabel={mode === "replace" ? "替换为这个动作" : "加入本次训练"}
        exercise={detailExercise}
        onClose={() => setDetailExercise(null)}
        onSelectExercise={canPick ? pick : undefined}
        token={props.token}
      />
    </SlideUpPage>
  );
}

const headerStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "8px 16px 12px",
};

function grabberStyle(theme: Theme): React.CSSProperties {
  return {
    backgroundColor: theme.colors.grab,
    borderRadius: 3,
    height: 5,
    justifySelf: "center",
    width: 36,
  };
}

const headerRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
};

function searchFieldStyle(theme: Theme): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.capsule,
    display: "flex",
    gap: 8,
    height: 42,
    padding: "0 8px 0 14px",
  };
}

function searchIconStyle(theme: Theme): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    display: "inline-flex",
    flex: "0 0 auto",
  };
}

function searchInputStyle(theme: Theme): React.CSSProperties {
  return {
    appearance: "none",
    background: "transparent",
    border: "none",
    color: theme.colors.tx,
    flex: "1 1 auto",
    font: "inherit",
    fontSize: 14,
    minWidth: 0,
    outline: "none",
    padding: 0,
  };
}

function clearButtonStyle(theme: Theme): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf3,
    border: "none",
    borderRadius: "50%",
    color: theme.colors.tx2,
    cursor: "pointer",
    display: "inline-flex",
    flex: "0 0 auto",
    height: 24,
    justifyContent: "center",
    padding: 0,
    width: 24,
  };
}

const bodyGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "84px minmax(0, 1fr)",
  height: "100%",
  minHeight: 0,
};

function railColumnStyle(theme: Theme): React.CSSProperties {
  return {
    borderRight: `1px solid ${theme.colors.divider}`,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarWidth: "none",
  };
}

const mainColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  minHeight: 0,
  minWidth: 0,
};

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  padding: "4px 12px 10px",
  scrollbarWidth: "none",
};

function chipStyle(
  theme: Theme,
  isActive: boolean,
  reducedMotion: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isActive ? theme.colors.ac : theme.colors.surf2,
    border: "none",
    borderRadius: 10,
    color: isActive ? theme.colors.acText : theme.colors.tx2,
    cursor: "pointer",
    flex: "0 0 auto",
    fontSize: 13,
    fontWeight: 700,
    height: 34,
    minWidth: 56,
    padding: "0 14px",
    transition: reducedMotion
      ? "none"
      : `background-color ${MOTION.quickMs}ms ${MOTION.standard}, color ${MOTION.quickMs}ms ${MOTION.standard}`,
    whiteSpace: "nowrap",
  };
}

function scrollAreaStyle(showIndex: boolean): React.CSSProperties {
  return {
    height: "100%",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: `0 ${showIndex ? 26 : 12}px calc(24px + env(safe-area-inset-bottom, 0px)) 12px`,
    position: "relative",
    WebkitOverflowScrolling: "touch",
  };
}

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  paddingBottom: 18,
};

function sectionTitleStyle(theme: Theme): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.2px",
    margin: "4px 0 0",
  };
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  margin: 0,
  padding: 0,
};

function resultCountStyle(theme: Theme): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    margin: "2px 0 8px",
  };
}

const indexStripStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  position: "absolute",
  right: 2,
  top: "50%",
  transform: "translateY(-50%)",
};

function indexButtonStyle(
  theme: Theme,
  isActive: boolean,
  reducedMotion: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: isActive ? theme.colors.ac : "transparent",
    border: "none",
    borderRadius: 9,
    color: isActive ? theme.colors.acText : theme.colors.accDim,
    cursor: "pointer",
    display: "flex",
    fontSize: 11,
    fontWeight: 700,
    height: 20,
    justifyContent: "center",
    padding: 0,
    transition: reducedMotion
      ? "none"
      : `background-color ${MOTION.quickMs}ms ${MOTION.standard}, color ${MOTION.quickMs}ms ${MOTION.standard}`,
    width: 20,
  };
}
