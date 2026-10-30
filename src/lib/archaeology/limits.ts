export type CrawlLimits = {
  maxDepth: number;
  maxPages: number;
  delayMs: number;
};

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

export function readCrawlLimits(): CrawlLimits {
  return {
    maxDepth: boundedInteger("CRAWL_MAX_DEPTH", 2, 0, 2),
    maxPages: boundedInteger("CRAWL_MAX_PAGES", 15, 1, 15),
    delayMs: boundedInteger("CRAWL_DELAY_MS", 2_000, 500, 10_000),
  };
}

export const crawlUserAgent = "TheUnclaimedArchaeology/1.0";
