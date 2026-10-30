import path from "node:path";
import { AudioLibraryList } from "@/components/audio/audio-library-list";
import { PresenceLab } from "@/components/presence/presence-lab";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Panel } from "@/components/ui/panel";
import { inspectAudioLibrary } from "@/lib/audio/inventory";
import { readPresenceTiming } from "@/lib/presence/timing";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Preferences</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Settings</h1>
      </header>
      <Panel title="Atmosphere and audio" eyebrow="This browser">
        <SettingsPanel />
      </Panel>
      <Panel title="Generated audio" eyebrow="Local files">
        <AudioLibraryList assets={inspectAudioLibrary(path.join(process.cwd(), "public", "audio"))} />
      </Panel>
      {process.env.NODE_ENV === "development" ? (
        <Panel title="Event testing" eyebrow="Development only">
          <PresenceLab timing={readPresenceTiming()} />
        </Panel>
      ) : null}
    </div>
  );
}
