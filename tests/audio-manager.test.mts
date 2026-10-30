import assert from "node:assert/strict";
import test from "node:test";
import { AudioManager, audioSource, nextAmbienceIndex, type AudioBackend, type PlayingClip } from "../src/lib/audio/manager.ts";

type Started = { src: string; loop: boolean; volume: number; stopped: boolean; onEnded: () => void };

function harness(missing: string[] = []) {
  const started: Started[] = [];
  const backend: AudioBackend = {
    start(src, options) {
      if (missing.includes(src)) {
        return null;
      }
      const record: Started = { src, loop: options.loop, volume: options.volume, stopped: false, onEnded: options.onEnded };
      started.push(record);
      const clip: PlayingClip = {
        setVolume(volume) {
          record.volume = volume;
        },
        stop() {
          if (record.stopped) {
            return;
          }
          record.stopped = true;
          record.onEnded();
        },
      };
      return clip;
    },
  };
  return { manager: new AudioManager(backend), started };
}

const heard = { enabled: true, ambient: 40, effects: 50 };

test("audio stays closed until begin and closes without leftover playback", () => {
  const { manager, started } = harness();
  assert.equal(manager.playRandomEffect(), "closed");
  assert.equal(manager.playVoice(), "closed");
  assert.equal(started.length, 0);
  manager.begin(heard, () => 0);
  assert.equal(started[0]?.src, audioSource("spooky_ambience_1"));
  assert.equal(started[0]?.loop, false);
  assert.equal(nextAmbienceIndex(3, 0, () => 0), 1);
  assert.ok((started[0]?.volume ?? 1) <= 0.55);
  manager.close();
  assert.equal(started[0]?.stopped, true);
  assert.equal(manager.playForEvent("screen-flicker"), "closed");
});

test("mute and volume changes apply immediately and missing files do not throw", () => {
  const { manager, started } = harness([audioSource("spooky_ambience_1")]);
  manager.begin({ enabled: false, ambient: 80, effects: 80 }, () => 0);
  assert.equal(started.length, 0);
  manager.update(heard);
  assert.equal(started[0]?.src, audioSource("spooky_ambience_2"));
  manager.update({ enabled: true, ambient: 0, effects: 70 });
  assert.equal(started[0]?.stopped, true);
  assert.equal(manager.playForEvent("screen-flicker"), "played");
  const effect = started.find((item) => item.src === audioSource("glitch_sound"));
  assert.ok(effect);
  assert.ok((effect?.volume ?? 1) <= 0.5);
  manager.update({ enabled: false, ambient: 0, effects: 70 });
  assert.equal(effect?.stopped, true);
  assert.equal(manager.playForEvent("secondary-cursor"), "silent");
  assert.equal(manager.playForEvent("voice", () => 0), "silent");
});

test("effects do not overlap or repeat the same clip", () => {
  const { manager, started } = harness();
  manager.begin({ enabled: true, ambient: 0, effects: 60 });
  assert.equal(manager.playForEvent("screen-flicker"), "played");
  assert.equal(manager.playForEvent("ghost-tab"), "busy");
  assert.equal(started.filter((item) => !item.loop).length, 1);
  started.find((item) => item.src === audioSource("glitch_sound"))?.onEnded();
  assert.equal(manager.playForEvent("screen-flicker"), "repeated");
  assert.equal(manager.playVoice(() => 0), "played");
  assert.equal(started.some((item) => item.src === audioSource("whisper_01")), true);
  started.find((item) => item.src === audioSource("whisper_01"))?.onEnded();
  assert.equal(manager.playVoice(() => 0), "played");
  assert.equal(started.at(-1)?.src, audioSource("whisper_02"));
});

test("mapped events choose the local file and skip a missing one", () => {
  const { manager } = harness([audioSource("keyboard_click"), audioSource("whisper_02")]);
  manager.begin({ enabled: true, ambient: 0, effects: 40 });
  assert.equal(manager.playForEvent("secondary-cursor"), "missing");
  assert.equal(manager.playForEvent("page-reflection"), "played");
  assert.equal(manager.playForEvent("cryptic-message"), "busy");
  const quiet = harness();
  quiet.manager.begin({ enabled: true, ambient: 0, effects: 30 });
  assert.equal(quiet.manager.playRandomEffect(() => 0), "played");
  assert.equal(quiet.started[0]?.src, audioSource("metal_knock"));
  quiet.started[0]?.onEnded();
  assert.equal(quiet.manager.playRandomEffect(() => 0), "played");
  assert.notEqual(quiet.started.at(-1)?.src, audioSource("metal_knock"));
});
