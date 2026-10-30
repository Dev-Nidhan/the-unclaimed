"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { attachPresenceLayer, startPresenceLoop, type PresenceSnapshot } from "@/lib/presence/runtime";
import type { PresenceTiming } from "@/lib/presence/schedule";
import { parsePreferences, settingsStorageKey } from "@/lib/settings/preferences";

function subscribe(onStoreChange: () => void) {
  const notify = () => onStoreChange();
  window.addEventListener("storage", notify);
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => {
    window.removeEventListener("storage", notify);
    media.removeEventListener("change", notify);
  };
}

function readSnapshot(pathname: string, timing: PresenceTiming): PresenceSnapshot {
  const preferences = parsePreferences(window.localStorage.getItem(settingsStorageKey) ?? "");
  const media = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.dataset.reducedMotion = preferences.reducedMotion || media ? "true" : "false";
  return {
    pathname,
    mode: preferences.presenceMode,
    reducedMotion: preferences.reducedMotion || media,
    audioEnabled: preferences.audioEnabled,
    timing,
  };
}

export function PresenceHost({ timing }: { timing: PresenceTiming }) {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, () => window.localStorage.getItem(settingsStorageKey) ?? "", () => "");
  const snapshotRef = useRef<PresenceSnapshot>({
    pathname,
    mode: "disabled",
    reducedMotion: false,
    audioEnabled: false,
    timing,
  });

  useEffect(() => {
    snapshotRef.current = readSnapshot(pathname, timing);
  }, [pathname, raw, timing]);

  useEffect(() => {
    return startPresenceLoop(() => snapshotRef.current);
  }, []);

  return <div ref={attachPresenceLayer} className="presence-layer" aria-hidden="true" />;
}
