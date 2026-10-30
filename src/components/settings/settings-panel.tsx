"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  parsePreferences,
  serializePreferences,
  settingsStorageKey,
  type Preferences,
  type PresenceMode,
} from "@/lib/settings/preferences";
import { fieldClass } from "@/components/ui/panel";
import { applyInvestigationAudio } from "@/lib/audio/session";

function applyPreferences(preferences: Preferences) {
  document.documentElement.dataset.reducedMotion = preferences.reducedMotion ? "true" : "false";
  document.documentElement.style.setProperty("--atmosphere", String(preferences.atmosphere / 100));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readRaw(): string {
  return window.localStorage.getItem(settingsStorageKey) ?? "";
}

function writePreferences(next: Preferences) {
  window.localStorage.setItem(settingsStorageKey, serializePreferences(next));
  window.dispatchEvent(new StorageEvent("storage", { key: settingsStorageKey }));
}

const modeOptions: Array<{ value: PresenceMode; label: string }> = [
  { value: "disabled", label: "Disabled" },
  { value: "subtle", label: "Subtle" },
  { value: "normal", label: "Normal" },
  { value: "intense", label: "Intense" },
];

export function SettingsPanel() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const preferences = parsePreferences(raw);

  useEffect(() => {
    applyPreferences(parsePreferences(raw));
  }, [raw]);

  function update(next: Preferences) {
    writePreferences(next);
    applyInvestigationAudio({
      enabled: next.audioEnabled,
      ambient: next.ambient,
      effects: next.effects,
    });
  }

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <p className="text-sm leading-6 text-muted">
        These preferences stay in this browser. Residual Presence can be disabled here. It does not call search, the
        cloud browser, or the local model.
      </p>
      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm">
          Atmosphere intensity
          <span className="text-muted">{preferences.atmosphere}</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={preferences.atmosphere}
          onChange={(event) => update({ ...preferences, atmosphere: Number(event.target.value) })}
          className="w-full accent-amber"
        />
      </label>
      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm">
          Ambient audio volume
          <span className="text-muted">{preferences.ambient}</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={preferences.ambient}
          disabled={!preferences.audioEnabled}
          onChange={(event) => update({ ...preferences, ambient: Number(event.target.value) })}
          className="w-full accent-amber"
        />
      </label>
      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm">
          Sound effects volume
          <span className="text-muted">{preferences.effects}</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={preferences.effects}
          disabled={!preferences.audioEnabled}
          onChange={(event) => update({ ...preferences, effects: Number(event.target.value) })}
          className="w-full accent-amber"
        />
      </label>
      <fieldset className="space-y-3">
        <legend className="text-sm">Playback and presence</legend>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={preferences.audioEnabled}
            onChange={(event) => update({ ...preferences, audioEnabled: event.target.checked })}
            className="size-4 accent-amber"
          />
          Enable audio
        </label>
        <p className="text-sm leading-6 text-muted">
          Unchecked is mute. Ambient and effect volumes stay in this browser and change the live sound immediately.
          Nothing plays before Begin Investigation.
        </p>
        <label className="block space-y-2 text-sm">
          Residual Presence
          <select
            className={fieldClass()}
            value={preferences.presenceMode}
            onChange={(event) => update({ ...preferences, presenceMode: event.target.value as PresenceMode })}
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="block text-muted">
            Disabled turns the whole system off. Subtle, normal, and intense change how strongly an event appears.
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={preferences.reducedMotion}
            onChange={(event) => update({ ...preferences, reducedMotion: event.target.checked })}
            className="size-4 accent-amber"
          />
          Reduced motion
        </label>
      </fieldset>
    </form>
  );
}
