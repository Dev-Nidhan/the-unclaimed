import { existsSync } from "node:fs";
import path from "node:path";
import { audioLibrary } from "./library";

export type AudioInventoryItem = {
  id: string;
  filename: string;
  label: string;
  kind: "sound" | "speech";
  present: boolean;
  publicPath: string;
};

export function inspectAudioLibrary(directory: string): AudioInventoryItem[] {
  return audioLibrary.map((asset) => {
    const filePath = path.join(directory, asset.filename);
    return {
      id: asset.id,
      filename: asset.filename,
      label: asset.label,
      kind: asset.kind,
      present: existsSync(filePath),
      publicPath: `/audio/${asset.filename}`,
    };
  });
}
