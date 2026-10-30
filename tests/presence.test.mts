import assert from "node:assert/strict";
import test from "node:test";
import { presenceEventIds, presenceEvents } from "../src/lib/presence/events.ts";
import { planPresenceEvent } from "../src/lib/presence/plans.ts";
import {
  choosePresenceEvent,
  createPresenceClock,
  defaultPresenceTiming,
  simulatePresence,
  tickPresence,
  type PresenceTiming,
} from "../src/lib/presence/schedule.ts";
import { readPresenceTiming } from "../src/lib/presence/timing.ts";
import { parsePreferences } from "../src/lib/settings/preferences.ts";

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

test("the first delay stays inside the configured window and a pause does not consume it", () => {
  const random = mulberry32(4);
  const clock = createPresenceClock(defaultPresenceTiming, random);
  assert.ok(clock.targetMs >= 90_000 && clock.targetMs <= 180_000);
  const paused = tickPresence(clock, 90_000, defaultPresenceTiming, random, true);
  assert.equal(paused.event, null);
  assert.equal(paused.clock.activeMs, 0);
});

test("later events respect the cooldown and do not repeat one of the previous three", () => {
  const timing: PresenceTiming = {
    ...defaultPresenceTiming,
    firstMinMs: 1_000,
    firstMaxMs: 1_000,
    nextMinMs: 1_000,
    nextMaxMs: 1_000,
    cooldownMs: 5_000,
  };
  const events = simulatePresence(timing, mulberry32(9), 40_000, 500);
  assert.ok(events.length >= 3);
  assert.ok(events[0] && events[0].atMs >= 1_000 && events[0].atMs <= 1_500);
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    const current = events[index];
    if (!previous || !current) {
      continue;
    }
    assert.ok(current.atMs - previous.atMs >= 5_000);
    const recent = events.slice(Math.max(0, index - 3), index).map((event) => event.id);
    assert.equal(recent.includes(current.id), false);
  }
});

test("weighted selection stays near 65, 25, and 10 percent and is not one fixed loop", () => {
  const counts = { common: 0, uncommon: 0, rare: 0 };
  const random = mulberry32(12);
  let recent: Array<(typeof presenceEventIds)[number]> = [];
  for (let index = 0; index < 4000; index += 1) {
    const id = choosePresenceEvent(recent, random);
    const tier = presenceEvents.find((event) => event.id === id)?.tier;
    if (tier) {
      counts[tier] += 1;
    }
    recent = [...recent, id].slice(-3);
  }
  assert.ok(counts.common / 4000 > 0.55 && counts.common / 4000 < 0.75);
  assert.ok(counts.uncommon / 4000 > 0.15 && counts.uncommon / 4000 < 0.35);
  assert.ok(counts.rare / 4000 > 0.04 && counts.rare / 4000 < 0.18);
  const first = simulatePresence(defaultPresenceTiming, mulberry32(3), 30 * 60 * 1000).map((event) => event.id);
  const second = simulatePresence(defaultPresenceTiming, mulberry32(8), 30 * 60 * 1000).map((event) => event.id);
  assert.notDeepEqual(first, second);
});

test("every event has an in-app plan, and reflections need a stored visit", () => {
  const trail = [
    { path: "/investigations/sample", title: "Sample layout record" },
    { path: "/settings", title: "Settings" },
  ];
  for (const id of presenceEventIds) {
    const plan = planPresenceEvent(id, {
      mode: "normal",
      reducedMotion: false,
      audioEnabled: true,
      trail,
      salt: 2,
    });
    assert.ok(plan);
    assert.equal(plan?.id, id);
    assert.equal((plan?.caption ?? "").toLowerCase().includes("warning"), false);
  }
  assert.equal(
    planPresenceEvent("page-reflection", {
      mode: "normal",
      reducedMotion: false,
      audioEnabled: false,
      trail: [],
      salt: 1,
    }),
    null,
  );
  const voice = planPresenceEvent("voice", {
    mode: "subtle",
    reducedMotion: true,
    audioEnabled: true,
    trail,
    salt: 1,
  });
  assert.equal(voice?.tone, false);
  assert.equal(
    planPresenceEvent("screen-flicker", {
      mode: "disabled",
      reducedMotion: false,
      audioEnabled: false,
      trail,
      salt: 1,
    }),
    null,
  );
});

test("presence timings and the disabled preference are configurable", () => {
  const timing = readPresenceTiming({
    PRESENCE_FIRST_MIN_MS: "1000",
    PRESENCE_FIRST_MAX_MS: "500",
    PRESENCE_COOLDOWN_MS: "2500",
  });
  assert.equal(timing.firstMinMs, 1000);
  assert.equal(timing.firstMaxMs, 1000);
  assert.equal(timing.cooldownMs, 2500);
  assert.equal(parsePreferences(JSON.stringify({ presenceEnabled: true })).presenceMode, "normal");
  assert.equal(parsePreferences(JSON.stringify({ presenceEnabled: false })).presenceMode, "disabled");
  assert.equal(parsePreferences(JSON.stringify({ presenceMode: "intense" })).presenceEnabled, true);
});
