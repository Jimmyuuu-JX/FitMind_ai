import { useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import { SlideUpPage } from "../../components/SlideUpPage";
import { useTheme } from "../../theme/ThemeContext";
import { SessionIcon } from "./TrainingSessionIcons";

export interface TrainingSessionNotesPageProps {
  note: string;
  onClose: () => void;
  onSave: (note: string) => void;
  open: boolean;
}

/** Above the session page (1000), below its popovers (1200). */
const NOTES_PAGE_Z_INDEX = 1100;

/**
 * 写心得: full page for the session's notes (训记 训练备注). Edits a copy;
 * 保存 writes it back to the draft, × discards.
 *
 * @param props - Current note, open state and handlers
 * @returns Slide-up notes page
 */
export function TrainingSessionNotesPage(props: TrainingSessionNotesPageProps) {
  const { theme } = useTheme();
  const [value, setValue] = useState(props.note);
  const [wasOpen, setWasOpen] = useState(props.open);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Start every visit from the draft's current note.
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) {
      setValue(props.note);
    }
  }

  useEffect(() => {
    if (!props.open) {
      return;
    }

    const timer = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 340);

    return () => window.clearTimeout(timer);
  }, [props.open]);

  return (
    <SlideUpPage
      ariaLabel="训练备注"
      header={
        <header style={headerStyle(theme)}>
          <button
            aria-label="关闭训练备注"
            onClick={props.onClose}
            style={closeButtonStyle(theme)}
            type="button"
          >
            <Icon name="x" size={24} />
          </button>
          <h2 style={titleStyle(theme)}>训练备注</h2>
          <button
            onClick={() => props.onSave(value)}
            style={saveButtonStyle(theme)}
            type="button"
          >
            保存
          </button>
        </header>
      }
      onClose={props.onClose}
      open={props.open}
      variant="full"
      zIndex={NOTES_PAGE_Z_INDEX}
    >
      <section style={sectionStyle}>
        <div style={sectionHeadStyle}>
          <span style={sectionIconStyle(theme)}>
            <SessionIcon name="note" size={20} />
          </span>
          <div>
            <h3 style={sectionTitleStyle(theme)}>本次训练备注</h3>
            <p style={sectionCopyStyle(theme)}>记录本次训练的感受和要点</p>
          </div>
        </div>
        <textarea
          aria-label="本次训练备注"
          onBlur={() => setIsFocused(false)}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="例如：状态不错，卧推最后一组力竭"
          ref={textareaRef}
          style={textareaStyle(theme, isFocused)}
          value={value}
        />
      </section>
    </SlideUpPage>
  );
}

function headerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    borderBottom: `1px solid ${theme.colors.bdr}`,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "72px 1fr 72px",
    padding: "max(12px, env(safe-area-inset-top, 12px)) 16px 12px",
  };
}

function closeButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: "transparent",
    border: "none",
    color: theme.colors.ac,
    cursor: "pointer",
    display: "flex",
    height: 40,
    justifyContent: "flex-start",
    padding: 0,
    width: 40,
  };
}

function titleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 17,
    fontWeight: 700,
    margin: 0,
    textAlign: "center",
  };
}

function saveButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.ac,
    border: "none",
    borderRadius: 999,
    color: theme.colors.acText,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    height: 38,
    justifySelf: "end",
    padding: "0 18px",
  };
}

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: "20px 16px 32px",
};

const sectionHeadStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
};

function sectionIconStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.colors.ac,
    borderRadius: 10,
    color: theme.colors.acText,
    display: "flex",
    flex: "0 0 auto",
    height: 36,
    justifyContent: "center",
    width: 36,
  };
}

function sectionTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
  };
}

function sectionCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    margin: "4px 0 0",
  };
}

function textareaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isFocused: boolean,
): React.CSSProperties {
  return {
    background: theme.colors.surf,
    border: `1px solid ${isFocused ? theme.colors.ac : theme.colors.bdr2}`,
    borderRadius: 16,
    color: theme.colors.tx,
    lineHeight: 1.6,
    minHeight: 180,
    outline: "none",
    padding: "14px 16px",
    transition: "border-color 150ms ease",
    resize: "vertical",
    width: "100%",
  };
}
