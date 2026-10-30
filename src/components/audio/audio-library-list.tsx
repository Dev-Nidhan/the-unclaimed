import type { AudioInventoryItem } from "@/lib/audio/inventory";

export function AudioLibraryList({ assets }: { assets: AudioInventoryItem[] }) {
  const generated = assets.filter((asset) => asset.present).length;
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted">
        {generated} of {assets.length} files are in public/audio. Playback uses those files. Opening this page does not
        call ElevenLabs.
      </p>
      <ul className="space-y-3">
        {assets.map((asset) => (
          <li key={asset.id} className="rounded-md border border-line px-3 py-3">
            <p className="text-sm">{asset.label}</p>
            <p className="text-xs tracking-[0.12em] text-muted uppercase">
              {asset.filename} · {asset.present ? "Generated" : "Not generated"}
            </p>
            {asset.present ? <audio className="mt-2 w-full" controls preload="none" src={asset.publicPath} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
