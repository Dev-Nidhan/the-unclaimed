export type PresenceMode = "disabled" | "subtle" | "normal" | "intense";

export type Preferences = {
  atmosphere: number;
  ambient: number;
  effects: number;
  audioEnabled: boolean;
  presenceEnabled: boolean;
  presenceMode: PresenceMode;
  reducedMotion: boolean;
};

export const settingsStorageKey = "the-unclaimed-settings";

export const defaultPreferences: Preferences = {
  atmosphere: 35,
  ambient: 0,
  effects: 0,
  audioEnabled: false,
  presenceEnabled: true,
  presenceMode: "normal",
  reducedMotion: false,
};

const modes: PresenceMode[] = ["disabled", "subtle", "normal", "intense"];

function clamp(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(100, Math.max(0, Math.round(number)));
}

export function parsePreferences(raw: string): Preferences {
  if (!raw) {
    return defaultPreferences;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const mode = modes.includes(parsed.presenceMode as PresenceMode)
      ? (parsed.presenceMode as PresenceMode)
      : parsed.presenceEnabled
        ? "normal"
        : "disabled";
    return {
      atmosphere: clamp(parsed.atmosphere, defaultPreferences.atmosphere),
      ambient: clamp(parsed.ambient, defaultPreferences.ambient),
      effects: clamp(parsed.effects, defaultPreferences.effects),
      audioEnabled: Boolean(parsed.audioEnabled),
      reducedMotion: Boolean(parsed.reducedMotion),
      presenceMode: mode,
      presenceEnabled: mode !== "disabled",
    };
  } catch {
    return defaultPreferences;
  }
}

export function serializePreferences(preferences: Preferences): string {
  const presenceMode = preferences.presenceMode;
  return JSON.stringify({
    ...preferences,
    presenceMode,
    presenceEnabled: presenceMode !== "disabled",
  });
}
