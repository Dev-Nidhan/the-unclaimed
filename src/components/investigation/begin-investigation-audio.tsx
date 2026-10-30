"use client";

import { useEffect, useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui/panel";
import {
  attachInvestigationAudio,
  beginInvestigationAudio,
  investigationAudioIsOpen,
  subscribeInvestigationAudio,
} from "@/lib/audio/session";
import { parsePreferences, settingsStorageKey } from "@/lib/settings/preferences";

function currentAudioSettings() {
  const preferences = parsePreferences(window.localStorage.getItem(settingsStorageKey) ?? "");
  return {
    enabled: preferences.audioEnabled,
    ambient: preferences.ambient,
    effects: preferences.effects,
  };
}

export function BeginInvestigationAudio({ investigationId }: { investigationId: string }) {
  const open = useSyncExternalStore(subscribeInvestigationAudio, investigationAudioIsOpen, () => false);

  useEffect(() => {
    attachInvestigationAudio(investigationId);
  }, [investigationId]);

  return (
    <div className="case-audio-control flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonClass()}
        onClick={() => {
          beginInvestigationAudio(currentAudioSettings());
          attachInvestigationAudio(investigationId);
        }}
      >
        {open ? "Restart session audio" : "Enable session audio"}
      </button>
      <p className="text-sm text-muted">
        {open
          ? "Audio is armed for this investigation. Mute and volume in Settings apply immediately."
          : "Local audio stays silent until this click. Missing files are skipped."}
      </p>
    </div>
  );
}
