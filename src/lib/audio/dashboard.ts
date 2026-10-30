import { nextAmbienceIndex, spookyAmbienceIds, audioSource } from "./manager";
import { parsePreferences, settingsStorageKey } from "../settings/preferences";

const files = spookyAmbienceIds.map((id) => audioSource(id));

let listeners = 0;
let stopped = true;
let previous = -1;
let current: HTMLAudioElement | null = null;
let resume: (() => void) | null = null;

function volume(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.localStorage.getItem(settingsStorageKey);
  if (!raw) {
    return 0;
  }
  const preferences = parsePreferences(raw);
  if (!preferences.audioEnabled) {
    return 0;
  }
  if (preferences.ambient <= 0) {
    return 0;
  }
  return Math.min(0.55, (preferences.ambient / 100) * 0.55);
}

function clearResume() {
  if (!resume || typeof document === "undefined") {
    return;
  }
  document.removeEventListener("pointerdown", resume);
  resume = null;
}

function playNext() {
  if (stopped || typeof Audio === "undefined") {
    return;
  }
  const level = volume();
  if (level === 0) {
    return;
  }
  previous = nextAmbienceIndex(files.length, previous, Math.random);
  const audio = new Audio(files[previous]);
  audio.preload = "auto";
  audio.loop = false;
  audio.volume = level;
  current = audio;
  audio.addEventListener("ended", () => {
    if (current === audio) {
      current = null;
      playNext();
    }
  });
  audio.addEventListener("error", () => {
    if (current === audio) {
      current = null;
      playNext();
    }
  });
  void audio.play().catch(() => {
    if (stopped || resume) {
      return;
    }
    resume = () => {
      clearResume();
      void audio.play().catch(() => undefined);
    };
    document.addEventListener("pointerdown", resume);
  });
}

export function startDashboardAmbience(): () => void {
  listeners += 1;
  if (listeners === 1) {
    stopped = false;
    playNext();
  }
  return () => {
    listeners = Math.max(0, listeners - 1);
    if (listeners > 0) {
      return;
    }
    stopped = true;
    clearResume();
    current?.pause();
    current = null;
    previous = -1;
  };
}
