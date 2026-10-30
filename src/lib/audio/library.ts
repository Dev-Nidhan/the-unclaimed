export type AudioKind = "sound" | "speech";

export type AudioAsset = {
  id: string;
  filename: string;
  kind: AudioKind;
  label: string;
  text: string;
  durationSeconds?: number;
  loop?: boolean;
};

export const soundModelIds = ["eleven_text_to_sound_v2", "eleven_text_to_sound_v3"] as const;
export const defaultSoundModel = "eleven_text_to_sound_v2";
export const defaultSpeechModel = "eleven_multilingual_v2";
export const defaultOutputFormat = "mp3_44100_128";

export const audioLibrary: readonly AudioAsset[] = [
  {
    id: "archive_ambience",
    filename: "archive_ambience.mp3",
    kind: "sound",
    label: "Abandoned digital archive",
    text: "A quiet abandoned digital archive at night. Extremely low electrical hum from old computer equipment, faint ventilation noise, subtle analog tape hiss and distant mechanical vibrations. Large empty room with old servers running unattended. Dark, realistic and atmospheric. No music, no voices, no sudden changes in volume. Designed as a seamless ambient loop.",
    durationSeconds: 18,
    loop: true,
  },
  {
    id: "server_hum",
    filename: "server_hum.mp3",
    kind: "sound",
    label: "Old server room",
    text: "A low continuous mechanical humming sound from an old server room. Multiple aging computer fans spinning at slightly different speeds, subtle electrical buzzing, distant hard drives operating and soft ventilation noise. Deep, restrained and realistic. No music, no voices, no dramatic changes. Create a consistent background sound suitable for looping.",
    durationSeconds: 14,
    loop: true,
  },
  {
    id: "empty_archive",
    filename: "empty_archive.mp3",
    kind: "sound",
    label: "Empty archive room tone",
    text: "The subtle atmosphere of a large abandoned office archive at night. Almost silent room tone, distant air conditioning, faint building creaks, an occasional barely audible metallic vibration and soft air movement. The environment feels empty and strangely still. Natural acoustic recording, no music, no speech, no identifiable foreground sounds.",
    durationSeconds: 15,
    loop: true,
  },
  {
    id: "hard_drive_start",
    filename: "hard_drive_start.mp3",
    kind: "sound",
    label: "Old hard drive starting",
    text: "An old mechanical hard drive unexpectedly spinning up after a long period of silence. A faint electrical activation click, followed by a gradually increasing low motor spin and a small mechanical vibration. Vintage computer hardware recording, realistic and understated. No music, no voices.",
    durationSeconds: 4,
    loop: true,
  },
  {
    id: "radio_static",
    filename: "radio_static.mp3",
    kind: "sound",
    label: "Radio interference",
    text: "A short burst of analog radio interference from an old communications receiver. Faint crackling static, an unstable radio frequency, subtle electronic hiss and a brief signal distortion before the transmission abruptly disappears. No intelligible speech, no music and no dramatic loud static.",
    durationSeconds: 4,
  },
  {
    id: "metal_knock",
    filename: "metal_knock.mp3",
    kind: "sound",
    label: "Distant metallic knock",
    text: "A single distant metallic knock inside a large empty computer archive room. A muted metal impact against an old cabinet or server rack, followed by a long, faint natural reverberation. The sound comes from far away. Quiet, realistic and slightly unsettling. No music, no voices, no loud impact.",
    durationSeconds: 3,
  },
  {
    id: "keyboard_click",
    filename: "keyboard_click.mp3",
    kind: "sound",
    label: "Unattended keyboard",
    text: "Two or three isolated mechanical keyboard key presses on an old computer keyboard in an otherwise silent room. Natural mechanical key switches with slightly different pitches, recorded close up but at a moderate volume. A short pause between presses. No typing sequence, no music, no voices.",
    durationSeconds: 3,
  },
  {
    id: "tape_rewind",
    filename: "tape_rewind.mp3",
    kind: "sound",
    label: "Tape recorder rewind",
    text: "An old analog cassette recorder briefly rewinding a damaged tape. Soft motor whirring, gentle mechanical clicking, uneven tape movement and faint magnetic tape hiss. The recording slows down and stops with a tiny mechanical click. Vintage archival equipment sound, realistic, no voices, no music.",
    durationSeconds: 5,
  },
  {
    id: "glitch_sound",
    filename: "glitch_sound.mp3",
    kind: "sound",
    label: "Digital glitch",
    text: "A very short and subtle digital malfunction sound. A tiny burst of corrupted electronic signal, several granular digital clicks, a brief frequency distortion and an abrupt return to silence. Realistic old-computer glitch, restrained and not excessively loud. No music, no voices, no cinematic impact.",
    durationSeconds: 2,
  },
  {
    id: "mystery_notification",
    filename: "mystery_notification.mp3",
    kind: "sound",
    label: "Mysterious notification",
    text: "A very quiet, unfamiliar electronic notification from an old computer system. A single soft high-pitched digital chime with a slightly unstable, wavering tail, followed by silence. It should sound like a notification from outdated software rather than a modern phone. Minimal, mysterious, no music, no voices.",
    durationSeconds: 2,
  },
  {
    id: "distant_whisper_wind",
    filename: "distant_whisper_wind.mp3",
    kind: "sound",
    label: "Distant whisper-like wind",
    text: "A barely audible airy sound moving through a large empty archival room, with a subtle breath-like texture and distant hollow resonance. It should suggest a voice-like presence without containing actual words or intelligible speech. Extremely quiet, realistic and ambiguous. No music, no recognizable human voice.",
    durationSeconds: 5,
  },
  {
    id: "corrupted_transmission",
    filename: "corrupted_transmission.mp3",
    kind: "sound",
    label: "Corrupted transmission",
    text: "An unusual electronic transmission from a damaged archival recording device. A faint activation click, soft radio static, a short distorted digital tone, a brief drop in signal, then a sudden return to complete silence. Subtle and unsettling, no intelligible speech, no music, no loud jumpscare.",
    durationSeconds: 6,
  },
  {
    id: "whisper_01",
    filename: "whisper_01.mp3",
    kind: "speech",
    label: "Whisper: already found",
    text: "I thought someone had already found this...",
  },
  {
    id: "whisper_02",
    filename: "whisper_02.mp3",
    kind: "speech",
    label: "Whisper: still there",
    text: "Is anyone still there?",
  },
  {
    id: "whisper_03",
    filename: "whisper_03.mp3",
    kind: "speech",
    label: "Whisper: incomplete copy",
    text: "This copy is incomplete.",
  },
];

export function findAudioAsset(id: string): AudioAsset | undefined {
  return audioLibrary.find((asset) => asset.id === id);
}

export function assertSoundModel(model: string): string {
  if (soundModelIds.includes(model as (typeof soundModelIds)[number])) {
    return model;
  }
  throw new Error("Sound effects use eleven_text_to_sound_v2 or eleven_text_to_sound_v3.");
}

export function assertDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration < 0.5 || duration > 30) {
    throw new Error("Duration must be between 0.5 and 30 seconds.");
  }
  return duration;
}

export function assertOutputName(filename: string): string {
  if (!/^[a-z0-9][a-z0-9_-]*\.mp3$/.test(filename)) {
    throw new Error("The output filename must be one mp3 name, such as archive_ambience.mp3.");
  }
  return filename;
}
