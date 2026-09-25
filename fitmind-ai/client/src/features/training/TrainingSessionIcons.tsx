/**
 * Session-editor glyphs that the shared `Icon` set does not carry (gear,
 * pencil, play/pause, toolbar symbols). Same drawing rules as `Icon`
 * (UI_SPEC §7): 24×24 viewBox, currentColor stroke, round caps.
 */
export type SessionIconName =
  | "check"
  | "gear"
  | "history"
  | "minimize"
  | "more"
  | "more-grid"
  | "note"
  | "pause"
  | "pencil"
  | "play"
  | "plus"
  | "timer";

export function SessionIcon(props: {
  name: SessionIconName;
  size?: number | undefined;
  strokeWidth?: number | undefined;
}) {
  const size = props.size ?? 20;

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? 2}
      style={{ display: "block", flexShrink: 0 }}
      viewBox="0 0 24 24"
      width={size}
    >
      {renderPath(props.name)}
    </svg>
  );
}

function renderPath(name: SessionIconName): React.ReactNode {
  switch (name) {
    case "check":
      return <path d="M5 12.5 10 17.5 19 7" pathLength={30} />;
    case "gear":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </>
      );
    case "history":
      return (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "minimize":
      return (
        <>
          <path d="M4 14h6v6" />
          <path d="M20 10h-6V4" />
          <path d="m14 10 7-7" />
          <path d="m3 21 7-7" />
        </>
      );
    case "more":
      return (
        <>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </>
      );
    case "more-grid":
      return (
        <>
          <rect height="7" rx="1.5" width="7" x="3" y="3" />
          <rect height="7" rx="1.5" width="7" x="14" y="3" />
          <rect height="7" rx="1.5" width="7" x="3" y="14" />
          <rect height="7" rx="1.5" width="7" x="14" y="14" />
        </>
      );
    case "note":
      return (
        <>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
          <path d="M8 8h6M8 12h4" />
          <path d="m20.5 13.5-6 6L12 20l.5-2.5 6-6a1.4 1.4 0 0 1 2 2Z" />
        </>
      );
    case "pause":
      return (
        <>
          <path d="M9 5v14" />
          <path d="M15 5v14" />
        </>
      );
    case "pencil":
      return (
        <>
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </>
      );
    case "play":
      return <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />;
    case "plus":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case "timer":
      return (
        <>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M10 2h4" />
        </>
      );
  }
}
