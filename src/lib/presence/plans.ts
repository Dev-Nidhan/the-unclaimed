import type { PresenceEventId, PresenceMode } from "./events";

export type VisitedPage = {
  path: string;
  title: string;
};

export type PresencePlan = {
  id: PresenceEventId;
  durationMs: number;
  flicker: boolean;
  icon: boolean;
  cursor: boolean;
  noise: boolean;
  static: boolean;
  transition: boolean;
  tone: boolean;
  text: string | null;
  caption: string | null;
  reflection: VisitedPage | null;
  ghost: { title: string; path: string; size: "preview" | "tab" } | null;
};

const anomalyLines = ["index, unfinished", "margin, occupied", "catalog, listening"];
const crypticLines = [
  "A page turned back on its own.",
  "The margin kept a second copy.",
  "Someone left the catalog open.",
];

function duration(mode: Exclude<PresenceMode, "disabled">, reducedMotion: boolean, full: number): number {
  if (reducedMotion) {
    return Math.min(full, 700);
  }
  if (mode === "subtle") {
    return Math.round(full * 0.7);
  }
  if (mode === "intense") {
    return Math.round(full * 1.25);
  }
  return full;
}

function earlierPage(trail: readonly VisitedPage[]): VisitedPage | null {
  if (trail.length < 2) {
    return null;
  }
  return trail[trail.length - 2] ?? null;
}

export function planPresenceEvent(
  id: PresenceEventId,
  input: {
    mode: PresenceMode;
    reducedMotion: boolean;
    audioEnabled: boolean;
    trail: readonly VisitedPage[];
    salt: number;
  },
): PresencePlan | null {
  if (input.mode === "disabled") {
    return null;
  }
  const mode = input.mode;
  const still = input.reducedMotion;
  const previous = earlierPage(input.trail);
  const base = {
    id,
    durationMs: duration(mode, still, 1400),
    flicker: false,
    icon: false,
    cursor: false,
    noise: false,
    static: false,
    transition: false,
    tone: false,
    text: null,
    caption: null,
    reflection: null,
    ghost: null,
  } satisfies PresencePlan;

  switch (id) {
    case "screen-flicker":
      return { ...base, durationMs: duration(mode, still, 420), flicker: !still, caption: still ? "The light shifted." : null };
    case "favicon-distortion":
      return { ...base, durationMs: duration(mode, still, 1600), icon: true };
    case "secondary-cursor":
      return still ? { ...base, durationMs: 700, caption: "A second pointer rested." } : { ...base, durationMs: duration(mode, false, 2200), cursor: true };
    case "visual-noise":
      return still ? { ...base, durationMs: 700, caption: "The surface grain held still." } : { ...base, noise: true };
    case "page-reflection":
      return previous ? { ...base, durationMs: duration(mode, still, 1800), reflection: previous } : null;
    case "ghost-tab-preview":
      return previous
        ? { ...base, durationMs: duration(mode, still, 1600), ghost: { ...previous, size: "preview" } }
        : null;
    case "radio-static":
      return still ? { ...base, durationMs: 700, caption: "Static, without the movement." } : { ...base, durationMs: duration(mode, false, 1100), static: true };
    case "text-anomaly":
      return { ...base, durationMs: duration(mode, still, 1500), text: anomalyLines[Math.abs(input.salt) % anomalyLines.length] ?? anomalyLines[0] };
    case "cryptic-message":
      return { ...base, durationMs: duration(mode, still, 2200), caption: crypticLines[Math.abs(input.salt) % crypticLines.length] ?? crypticLines[0] };
    case "ghost-tab":
      return previous ? { ...base, durationMs: duration(mode, still, 2600), ghost: { ...previous, size: "tab" } } : null;
    case "voice":
      return {
        ...base,
        durationMs: duration(mode, still, 900),
        tone: false,
        caption: input.audioEnabled
          ? "A saved whisper plays only after Begin Investigation, and only if that file is present."
          : "The voice stayed in the page and made no sound.",
      };
    case "interface-transition":
      return still
        ? { ...base, durationMs: 700, caption: "The room dimmed, then settled." }
        : { ...base, durationMs: duration(mode, false, 900), transition: true };
    default:
      return null;
  }
}
