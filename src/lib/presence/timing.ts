import { defaultPresenceTiming, type PresenceTiming } from "./schedule";
import { presenceWeights } from "./events";

function bounded(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(3_600_000, Math.max(0, Math.round(value)));
}

function read(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) {
    return fallback;
  }
  return bounded(Number(raw), fallback);
}

export function readPresenceTiming(env: Record<string, string | undefined> = process.env): PresenceTiming {
  const firstMinMs = read(env, "PRESENCE_FIRST_MIN_MS", defaultPresenceTiming.firstMinMs);
  const firstMaxMs = Math.max(firstMinMs, read(env, "PRESENCE_FIRST_MAX_MS", defaultPresenceTiming.firstMaxMs));
  const nextMinMs = read(env, "PRESENCE_NEXT_MIN_MS", defaultPresenceTiming.nextMinMs);
  const nextMaxMs = Math.max(nextMinMs, read(env, "PRESENCE_NEXT_MAX_MS", defaultPresenceTiming.nextMaxMs));
  const cooldownMs = read(env, "PRESENCE_COOLDOWN_MS", defaultPresenceTiming.cooldownMs);
  const weights = {
    common: read(env, "PRESENCE_WEIGHT_COMMON", presenceWeights.common),
    uncommon: read(env, "PRESENCE_WEIGHT_UNCOMMON", presenceWeights.uncommon),
    rare: read(env, "PRESENCE_WEIGHT_RARE", presenceWeights.rare),
  };
  const sum = weights.common + weights.uncommon + weights.rare;
  return {
    firstMinMs,
    firstMaxMs,
    nextMinMs,
    nextMaxMs,
    cooldownMs,
    weights: sum > 0 ? weights : { ...presenceWeights },
  };
}
