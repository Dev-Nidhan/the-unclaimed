import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { audioLibrary, assertDuration, assertOutputName, findAudioAsset, type AudioAsset } from "../src/lib/audio/library";
import { buildGenerationRequest, requestAudio } from "../src/lib/audio/elevenlabs";
import { inspectAudioLibrary } from "../src/lib/audio/inventory";

const outputRoot = path.join(process.cwd(), "public", "audio");

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a value.`);
  }
  return value;
}

function help(): string {
  return [
    "Generate local audio files with ElevenLabs. This script is not run by the app.",
    "",
    "List files already in public/audio:",
    "  npm run audio:list",
    "",
    "Generate one sound effect:",
    "  npm run audio:generate -- --id archive_ambience",
    "",
    "Generate one whisper. ELEVENLABS_VOICE_ID must be a voice you are allowed to use:",
    "  npm run audio:generate -- --id whisper_01",
    "",
    "Generate every missing file:",
    "  npm run audio:generate -- --all",
    "",
    "Replace a file that is already there:",
    "  npm run audio:generate -- --id radio_static --force",
    "",
    "Optional flags: --model, --duration, --prompt, --output, --voice",
    "Sound models: eleven_text_to_sound_v2, eleven_text_to_sound_v3",
    "Speech model default: eleven_multilingual_v2",
  ].join("\n");
}

async function writeAsset(filename: string, bytes: Buffer): Promise<void> {
  const safeName = assertOutputName(filename);
  await mkdir(outputRoot, { recursive: true });
  const temporary = path.join(outputRoot, `.${safeName}.partial`);
  await writeFile(temporary, bytes);
  await rename(temporary, path.join(outputRoot, safeName));
  console.log(`Wrote public/audio/${safeName}`);
}

async function generateOne(asset: AudioAsset, argv: string[], force: boolean): Promise<void> {
  const durationFlag = readFlag(argv, "--duration");
  const durationSeconds = durationFlag === undefined ? undefined : assertDuration(Number(durationFlag));
  if (durationSeconds !== undefined && asset.kind === "speech") {
    throw new Error("Duration applies to sound effects. Speech uses the spoken line.");
  }
  const filename = assertOutputName(readFlag(argv, "--output") ?? asset.filename);
  if (existsSync(path.join(outputRoot, filename)) && !force) {
    console.log(`Skipped ${filename}. The file already exists. Pass --force to replace it.`);
    return;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set.");
  }
  const request = buildGenerationRequest(asset, {
    model: readFlag(argv, "--model"),
    durationSeconds,
    prompt: readFlag(argv, "--prompt"),
    voiceId: readFlag(argv, "--voice") ?? process.env.ELEVENLABS_VOICE_ID,
  });
  const bytes = await requestAudio(request, apiKey);
  await writeAsset(filename, bytes);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.length === 0) {
    console.log(help());
    return;
  }
  if (argv.includes("--list")) {
    for (const item of inspectAudioLibrary(outputRoot)) {
      console.log(`${item.present ? "generated" : "missing   "}  ${item.filename}  ${item.label}`);
    }
    return;
  }
  const force = argv.includes("--force");
  const all = argv.includes("--all");
  if (all && ["--output", "--prompt", "--duration", "--model", "--voice"].some((flag) => argv.includes(flag))) {
    throw new Error("Use --id when changing the model, duration, prompt, voice, or output. --all uses the library settings.");
  }
  const selected = all
    ? [...audioLibrary]
    : [findAudioAsset(readFlag(argv, "--id") ?? "")].filter((asset): asset is AudioAsset => Boolean(asset));
  if (!all && selected.length === 0) {
    throw new Error("Choose a library id with --id, or pass --all. Use --list to see the ids.");
  }
  for (const asset of selected) {
    await generateOne(asset, argv, force);
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "Audio generation failed.";
  console.error(message);
  try {
    const Sentry = await import("@sentry/nextjs");
    const { sentryInitOptions } = await import("../src/lib/sentry/options");
    const { reportOperationFailure } = await import("../src/lib/sentry/report");
    Sentry.init(sentryInitOptions());
    reportOperationFailure("elevenlabs", error);
    await Sentry.flush(2000);
  } catch {
    // Monitoring is optional. The generation error is already printed.
  }
  process.exitCode = 1;
});
