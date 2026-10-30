export const audioClipIds = [
  "archive_ambience",
  "server_hum",
  "empty_archive",
  "radio_static",
  "metal_knock",
  "keyboard_click",
  "hard_drive_start",
  "tape_rewind",
  "glitch_sound",
  "mystery_notification",
  "distant_whisper_wind",
  "corrupted_transmission",
  "whisper_01",
  "whisper_02",
  "whisper_03",
] as const;

export type AudioClipId = (typeof audioClipIds)[number];
export type AudioChannel = "ambient" | "effect" | "voice";
export type AudioPlayResult = "played" | "silent" | "missing" | "busy" | "repeated" | "closed";

export type AudioSettings = {
  enabled: boolean;
  ambient: number;
  effects: number;
};

export type PlayingClip = {
  setVolume: (volume: number) => void;
  stop: () => void;
};

export type AudioBackend = {
  start: (
    src: string,
    options: { loop: boolean; volume: number; onEnded: () => void },
  ) => PlayingClip | null;
};

const ceilings: Record<AudioChannel, number> = {
  ambient: 0.55,
  effect: 0.5,
  voice: 0.7,
};

export const spookyAmbienceIds = ["archive_ambience", "server_hum", "empty_archive"] as const;
export type SpookyAmbienceId = (typeof spookyAmbienceIds)[number];

const effectPool: AudioClipId[] = [
  "metal_knock",
  "keyboard_click",
  "hard_drive_start",
  "tape_rewind",
  "glitch_sound",
  "radio_static",
  "mystery_notification",
  "corrupted_transmission",
];
const voicePool: AudioClipId[] = ["distant_whisper_wind"];

const eventClips: Record<string, { id: AudioClipId; channel: AudioChannel; gain: number }> = {
  "screen-flicker": { id: "glitch_sound", channel: "effect", gain: 0.45 },
  "favicon-distortion": { id: "glitch_sound", channel: "effect", gain: 0.35 },
  "visual-noise": { id: "glitch_sound", channel: "effect", gain: 0.25 },
  "secondary-cursor": { id: "keyboard_click", channel: "effect", gain: 0.55 },
  "ghost-tab": { id: "hard_drive_start", channel: "effect", gain: 0.35 },
  "ghost-tab-preview": { id: "hard_drive_start", channel: "effect", gain: 0.25 },
  "page-reflection": { id: "tape_rewind", channel: "effect", gain: 0.35 },
  "cryptic-message": { id: "mystery_notification", channel: "effect", gain: 0.3 },
  "text-anomaly": { id: "radio_static", channel: "effect", gain: 0.3 },
  "radio-static": { id: "radio_static", channel: "effect", gain: 0.3 },
  "interface-transition": { id: "corrupted_transmission", channel: "effect", gain: 0.25 },
  voice: { id: "distant_whisper_wind", channel: "voice", gain: 0.25 },
};

export function audioSource(id: AudioClipId | SpookyAmbienceId): string {
  return `/audio/${id}.mp3`;
}

export function nextAmbienceIndex(length: number, previous: number, random: () => number): number {
  if (length <= 1) {
    return 0;
  }
  const index = Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
  if (index === previous) {
    return (index + 1) % length;
  }
  return index;
}

export function outputVolume(channel: AudioChannel, settings: AudioSettings, gain = 1): number {
  if (!settings.enabled) {
    return 0;
  }
  const slider = channel === "ambient" ? settings.ambient : settings.effects;
  const level = Math.min(100, Math.max(0, slider)) / 100;
  return Math.min(ceilings[channel], ceilings[channel] * level * Math.min(1, Math.max(0, gain)));
}

export class AudioManager {
  private readonly backend: AudioBackend;
  private open = false;
  private settings: AudioSettings = { enabled: false, ambient: 0, effects: 0 };
  private missing = new Set<AudioClipId | SpookyAmbienceId>();
  private recent: AudioClipId[] = [];
  private ambient: PlayingClip | null = null;
  private ambientId: SpookyAmbienceId | null = null;
  private lastAmbient: SpookyAmbienceId | null = null;
  private random: () => number = Math.random;
  private effect: PlayingClip | null = null;
  private audible = true;

  constructor(backend: AudioBackend) {
    this.backend = backend;
  }

  get isOpen(): boolean {
    return this.open;
  }

  begin(settings: AudioSettings, random: () => number = Math.random): void {
    this.random = random;
    this.settings = settings;
    if (this.open) {
      this.update(settings);
      return;
    }
    this.open = true;
    this.ensureAmbient();
  }

  close(): void {
    this.ambient?.stop();
    this.effect?.stop();
    this.ambient = null;
    this.ambientId = null;
    this.lastAmbient = null;
    this.effect = null;
    this.open = false;
  }

  setAudible(audible: boolean): void {
    this.audible = audible;
    if (!audible) {
      this.ambient?.stop();
      this.effect?.stop();
      this.ambient = null;
      this.ambientId = null;
      this.effect = null;
      return;
    }
    this.ensureAmbient();
  }

  update(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.open) {
      return;
    }
    if (outputVolume("ambient", settings) === 0) {
      this.ambient?.stop();
      this.ambient = null;
      this.ambientId = null;
    } else if (this.ambient) {
      this.ambient.setVolume(outputVolume("ambient", settings));
    } else {
      this.ensureAmbient();
    }
    if (this.effect) {
      if (outputVolume("effect", settings) === 0) {
        this.effect.stop();
        this.effect = null;
      } else {
        this.effect.setVolume(outputVolume("effect", settings));
      }
    }
  }

  playForEvent(eventId: string, random: () => number = Math.random): AudioPlayResult {
    const mapped = eventClips[eventId];
    if (!mapped) {
      return "silent";
    }
    if (mapped.channel === "voice") {
      return this.playVoice(random);
    }
    return this.playClip(mapped.id, mapped.channel, mapped.gain);
  }

  playRandomEffect(random: () => number = Math.random): AudioPlayResult {
    if (!this.open) {
      return "closed";
    }
    const choices = effectPool.filter((id) => !this.recent.includes(id) && !this.missing.has(id));
    if (choices.length === 0) {
      return "repeated";
    }
    const id = choices[Math.floor(random() * choices.length)] ?? choices[0];
    if (!id) {
      return "repeated";
    }
    return this.playClip(id, "effect", 0.6);
  }

  playVoice(random: () => number = Math.random): AudioPlayResult {
    if (!this.open) {
      return "closed";
    }
    const choices = voicePool.filter((id) => !this.recent.includes(id) && !this.missing.has(id));
    if (choices.length === 0) {
      return "repeated";
    }
    const id = choices[Math.floor(random() * choices.length)] ?? choices[0];
    if (!id) {
      return "repeated";
    }
    return this.playClip(id, "voice", 0.8);
  }

  private ensureAmbient(): void {
    if (!this.open || !this.audible || this.ambient || outputVolume("ambient", this.settings) === 0) {
      return;
    }
    const available = spookyAmbienceIds.filter((id) => !this.missing.has(id));
    const choices = available.filter((id) => id !== this.lastAmbient);
    const pool = choices.length > 0 ? choices : available;
    if (pool.length === 0) {
      return;
    }
    const id = pool[nextAmbienceIndex(pool.length, -1, this.random)] ?? pool[0];
    if (!id) {
      return;
    }
    const started = this.start(id, "ambient", 0.28, true);
    if (!started) {
      this.ensureAmbient();
      return;
    }
    this.ambient = started;
    this.ambientId = id;
  }

  private playClip(id: AudioClipId, channel: AudioChannel, gain: number): AudioPlayResult {
    if (!this.open) {
      return "closed";
    }
    if (!this.audible || outputVolume(channel, this.settings, gain) === 0) {
      return "silent";
    }
    if (this.missing.has(id)) {
      return "missing";
    }
    if (this.recent.includes(id)) {
      return "repeated";
    }
    if (this.effect || this.ambientId === id) {
      return "busy";
    }
    const started = this.start(id, channel, gain, false);
    if (!started) {
      return "missing";
    }
    this.effect = started;
    this.recent = [...this.recent, id].slice(-3);
    return "played";
  }

  private start(id: AudioClipId | SpookyAmbienceId, channel: AudioChannel, gain: number, loop: boolean): PlayingClip | null {
    const volume = outputVolume(channel, this.settings, gain);
    const box: { current: PlayingClip | null } = { current: null };
    const started = this.backend.start(audioSource(id), {
      loop,
      volume,
      onEnded: () => {
        if (box.current && this.effect === box.current) {
          this.effect = null;
        }
        if (box.current && this.ambient === box.current) {
          this.lastAmbient = this.ambientId;
          this.ambient = null;
          this.ambientId = null;
          this.ensureAmbient();
        }
      },
    });
    if (!started) {
      this.missing.add(id);
      return null;
    }
    box.current = {
      setVolume: (next: number) => started.setVolume(next),
      stop: () => started.stop(),
    };
    return box.current;
  }
}
