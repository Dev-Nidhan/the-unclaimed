import { AudioManager, type AudioSettings } from "./manager";
import type { AudioBackend } from "./manager";

let manager: AudioManager | null = null;
let boundInvestigationId: string | null = null;
let watchingVisibility = false;
const listeners = new Set<() => void>();

function emitAudio(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeInvestigationAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function investigationAudioIsOpen(): boolean {
  return manager?.isOpen ?? false;
}

function browserBackend(): AudioBackend {
  const failed = new Set<string>();
  return {
    start(src, options) {
      if (failed.has(src) || typeof Audio === "undefined") {
        return null;
      }
      const audio = new Audio();
      audio.preload = "auto";
      audio.loop = options.loop;
      audio.volume = Math.min(1, Math.max(0, options.volume));
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        options.onEnded();
      };
      audio.addEventListener("error", () => {
        failed.add(src);
        finish();
      });
      audio.addEventListener("ended", finish);
      audio.src = src;
      void audio.play().catch(() => {
        failed.add(src);
        finish();
      });
      return {
        setVolume(volume: number) {
          audio.volume = Math.min(1, Math.max(0, volume));
        },
        stop() {
          audio.pause();
          finish();
        },
      };
    },
  };
}

function sharedManager(): AudioManager {
  if (!manager) {
    manager = new AudioManager(browserBackend());
  }
  return manager;
}

function watchVisibility() {
  if (watchingVisibility || typeof document === "undefined") {
    return;
  }
  watchingVisibility = true;
  document.addEventListener("visibilitychange", () => {
    manager?.setAudible(!document.hidden);
  });
}

export function beginInvestigationAudio(settings: AudioSettings): void {
  watchVisibility();
  sharedManager().begin(settings);
  if (typeof document !== "undefined" && document.hidden) {
    sharedManager().setAudible(false);
  }
  emitAudio();
}

export function applyInvestigationAudio(settings: AudioSettings): void {
  manager?.update(settings);
}

export function attachInvestigationAudio(investigationId: string): void {
  if (!manager?.isOpen) {
    return;
  }
  if (boundInvestigationId && boundInvestigationId !== investigationId) {
    closeInvestigationAudio();
    return;
  }
  boundInvestigationId = investigationId;
  emitAudio();
}

export function closeInvestigationAudio(): void {
  manager?.close();
  boundInvestigationId = null;
  emitAudio();
}

export function playInvestigationAudio(eventId: string): void {
  manager?.playForEvent(eventId);
}

export function syncInvestigationAudio(pathname: string): void {
  if (!manager?.isOpen) {
    return;
  }
  if (!boundInvestigationId) {
    const opening = pathname === "/investigations/new" || pathname.startsWith("/investigations/new/");
    const insideRecord = /^\/investigations\/[^/]+/.test(pathname);
    if (!opening && !insideRecord) {
      closeInvestigationAudio();
    }
    return;
  }
  const prefix = `/investigations/${boundInvestigationId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    closeInvestigationAudio();
  }
}
