import { presenceEvents, presenceWeights, type PresenceEventId, type PresenceMode, type PresenceTier } from "./events";

export type PresenceTiming = {
  firstMinMs: number;
  firstMaxMs: number;
  nextMinMs: number;
  nextMaxMs: number;
  cooldownMs: number;
  weights: Record<PresenceTier, number>;
};

export const defaultPresenceTiming: PresenceTiming = {
  firstMinMs: 90_000,
  firstMaxMs: 180_000,
  nextMinMs: 120_000,
  nextMaxMs: 300_000,
  cooldownMs: 75_000,
  weights: { ...presenceWeights },
};

export type PresenceClock = {
  activeMs: number;
  targetMs: number;
  phase: "first" | "later";
  lastFiredMs: number | null;
  recent: PresenceEventId[];
};

export type PresenceSessionStage = "quiet" | "stirring" | "near";

export function presenceSessionStage(activeMs: number): PresenceSessionStage {
  if (activeMs >= 12 * 60_000) {
    return "near";
  }
  if (activeMs >= 4 * 60_000) {
    return "stirring";
  }
  return "quiet";
}

export function sessionPresenceWeights(
  activeMs: number,
  weights: Record<PresenceTier, number>,
  mode: Exclude<PresenceMode, "disabled">,
): Record<PresenceTier, number> {
  const progress = Math.min(1, Math.max(0, (activeMs - 3 * 60_000) / (9 * 60_000)));
  const modeScale = mode === "subtle" ? 0.55 : mode === "intense" ? 1.25 : 1;
  return {
    common: weights.common,
    uncommon: weights.uncommon * (0.85 + progress * 0.15),
    rare: weights.rare * (0.3 + progress * 0.7) * modeScale,
  };
}

export function delayFor(phase: "first" | "later", timing: PresenceTiming, random: () => number): number {
  const min = phase === "first" ? timing.firstMinMs : timing.nextMinMs;
  const max = Math.max(min, phase === "first" ? timing.firstMaxMs : timing.nextMaxMs);
  return min + Math.floor(random() * (max - min + 1));
}

export function createPresenceClock(timing: PresenceTiming, random: () => number): PresenceClock {
  return {
    activeMs: 0,
    targetMs: delayFor("first", timing, random),
    phase: "first",
    lastFiredMs: null,
    recent: [],
  };
}

export function choosePresenceEvent(
  recent: readonly PresenceEventId[],
  random: () => number,
  weights: Record<PresenceTier, number> = presenceWeights,
): PresenceEventId {
  const blocked = new Set(recent.slice(-3));
  let pool = presenceEvents.filter((event) => !blocked.has(event.id));
  if (pool.length === 0) {
    pool = [...presenceEvents];
  }
  const tiers = (["common", "uncommon", "rare"] as const).filter((tier) => pool.some((event) => event.tier === tier));
  const available = tiers.length > 0 ? tiers : (["common"] as const);
  const weightSum = available.reduce((sum, tier) => sum + Math.max(0, weights[tier]), 0);
  let roll = random() * (weightSum || 1);
  let tier: PresenceTier = available[0] ?? "common";
  if (weightSum > 0) {
    for (const candidate of available) {
      roll -= Math.max(0, weights[candidate]);
      if (roll < 0) {
        tier = candidate;
        break;
      }
    }
  }
  const group = pool.filter((event) => event.tier === tier);
  const choices = group.length > 0 ? group : pool;
  const index = Math.min(choices.length - 1, Math.floor(random() * choices.length));
  return choices[index]?.id ?? "screen-flicker";
}

export function tickPresence(
  clock: PresenceClock,
  deltaMs: number,
  timing: PresenceTiming,
  random: () => number,
  paused: boolean,
  weights: Record<PresenceTier, number> = timing.weights,
): { clock: PresenceClock; event: PresenceEventId | null } {
  if (paused || deltaMs <= 0) {
    return { clock, event: null };
  }
  const activeMs = clock.activeMs + deltaMs;
  if (activeMs < clock.targetMs) {
    return { clock: { ...clock, activeMs }, event: null };
  }
  if (clock.lastFiredMs != null && activeMs - clock.lastFiredMs < timing.cooldownMs) {
    return {
      clock: { ...clock, activeMs, targetMs: clock.lastFiredMs + timing.cooldownMs },
      event: null,
    };
  }
  const event = choosePresenceEvent(clock.recent, random, weights);
  const wait = Math.max(delayFor("later", timing, random), timing.cooldownMs);
  return {
    clock: {
      activeMs,
      targetMs: activeMs + wait,
      phase: "later",
      lastFiredMs: activeMs,
      recent: [...clock.recent, event].slice(-3),
    },
    event,
  };
}

export function simulatePresence(
  timing: PresenceTiming,
  random: () => number,
  durationMs: number,
  stepMs = 1000,
): Array<{ atMs: number; id: PresenceEventId }> {
  let clock = createPresenceClock(timing, random);
  const events: Array<{ atMs: number; id: PresenceEventId }> = [];
  for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
    const weights = sessionPresenceWeights(clock.activeMs + stepMs, timing.weights, "normal");
    const next = tickPresence(clock, stepMs, timing, random, false, weights);
    clock = next.clock;
    if (next.event) {
      events.push({ atMs: clock.activeMs, id: next.event });
    }
  }
  return events;
}
