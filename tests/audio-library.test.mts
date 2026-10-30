import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { audioLibrary } from "../src/lib/audio/library.ts";
import { buildGenerationRequest, describeElevenLabsError, requestAudio } from "../src/lib/audio/elevenlabs.ts";
import { inspectAudioLibrary } from "../src/lib/audio/inventory.ts";

test("the library names the nine local files and does not call ElevenLabs", () => {
  assert.deepEqual(
    audioLibrary.map((asset) => asset.filename),
    [
      "archive_ambience.mp3",
      "server_hum.mp3",
      "radio_static.mp3",
      "metal_knock.mp3",
      "keyboard_click.mp3",
      "glitch_sound.mp3",
      "whisper_01.mp3",
      "whisper_02.mp3",
      "whisper_03.mp3",
    ],
  );
  assert.equal(audioLibrary.filter((asset) => asset.kind === "speech").length, 3);
});

test("sound and speech requests use the documented endpoints and keep the key out of the URL", () => {
  const sound = buildGenerationRequest(audioLibrary[0]!, { durationSeconds: 8 });
  assert.equal(sound.url.startsWith("https://api.elevenlabs.io/v1/sound-generation?"), true);
  assert.equal(sound.body.model_id, "eleven_text_to_sound_v2");
  assert.equal(sound.body.duration_seconds, 8);
  assert.equal(sound.body.loop, true);

  const speech = buildGenerationRequest(audioLibrary[6]!, { voiceId: "libraryvoice1" });
  assert.equal(speech.url, "https://api.elevenlabs.io/v1/text-to-speech/libraryvoice1?output_format=mp3_44100_128");
  assert.equal(speech.body.text, "I thought someone had already found this...");
  assert.equal(JSON.stringify(speech).includes("secret-key"), false);
  assert.throws(() => buildGenerationRequest(audioLibrary[6]!, {}), /ELEVENLABS_VOICE_ID/);
  assert.throws(() => buildGenerationRequest(audioLibrary[3]!, { durationSeconds: 40 }), /0\.5 and 30/);
  assert.throws(() => buildGenerationRequest(audioLibrary[0]!, { model: "eleven_turbo" }), /eleven_text_to_sound_v2/);
});

test("an existing file is visible in the inventory and API errors do not echo the key", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "unclaimed-audio-"));
  await writeFile(path.join(directory, "radio_static.mp3"), Buffer.from("not-checked-in"));
  const inventory = inspectAudioLibrary(directory);
  assert.equal(inventory.find((item) => item.filename === "radio_static.mp3")?.present, true);
  assert.equal(inventory.find((item) => item.filename === "whisper_02.mp3")?.present, false);

  const message = describeElevenLabsError(401, JSON.stringify({ detail: "bad key secret-key" }), "secret-key");
  assert.equal(message.includes("secret-key"), false);
  assert.match(message, /401/);

  let called = false;
  await assert.rejects(
    requestAudio(buildGenerationRequest(audioLibrary[4]!), "secret-key", async () => {
      called = true;
      return new Response(JSON.stringify({ detail: [{ msg: "rejected secret-key" }] }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    }),
    /422/,
  );
  assert.equal(called, true);
});

test("a successful sound response is kept as file bytes", async () => {
  const bytes = await requestAudio(buildGenerationRequest(audioLibrary[4]!), "secret-key", async () => {
    return new Response(Buffer.from("ID3fake"), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });
  });
  assert.equal(bytes.toString("utf8"), "ID3fake");
});
