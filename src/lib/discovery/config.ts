import type { SearchLimits } from "./types";

function boundedInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function readSearchLimits(): SearchLimits {
  return {
    maxQueries: boundedInteger("SEARCH_MAX_QUERIES", 4, 3, 5),
    resultsPerQuery: boundedInteger("SEARCH_RESULTS_PER_QUERY", 5, 1, 10),
    timeoutMs: boundedInteger("SEARCH_TIMEOUT_MS", 15_000, 3_000, 30_000),
  };
}

export function requireSerpApiKey(): string {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not set.");
  }
  return apiKey;
}
