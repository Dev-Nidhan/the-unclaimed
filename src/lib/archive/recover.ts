import { createArchiveCapture, listArchiveUrls, listInvestigationSources } from "../db/queries";
import {
  WaybackRequestError,
  checkAvailability,
  chooseCaptures,
  listCaptures,
  waybackTimestampToDate,
} from "./wayback";

export type ArchiveRecovery = {
  checked: number;
  saved: number;
  available: number;
  missing: number;
  errors: string[];
  stopped: boolean;
};

function readLimit(name: string, fallback: number, min: number, max: number): number {
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

export function readArchiveLimits() {
  return {
    maxSources: readLimit("ARCHIVE_MAX_SOURCES", 5, 1, 15),
    maxCaptures: readLimit("ARCHIVE_MAX_CAPTURES", 5, 1, 10),
    timeoutMs: readLimit("ARCHIVE_TIMEOUT_MS", 15_000, 3_000, 30_000),
  };
}

async function probeArchive(archiveUrl: string, timeoutMs: number): Promise<"available" | "missing" | "unknown"> {
  try {
    const response = await fetch(archiveUrl, {
      redirect: "follow",
      headers: { "user-agent": "TheUnclaimedArchaeology/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel().catch(() => undefined);
    if (response.status >= 200 && response.status < 400) {
      return "available";
    }
    if (response.status === 404 || response.status === 410) {
      return "missing";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function recoverSourceArchives(investigationId: string): Promise<ArchiveRecovery> {
  const limits = readArchiveLimits();
  const sources = (await listInvestigationSources(investigationId)).slice(0, limits.maxSources);
  const result: ArchiveRecovery = {
    checked: sources.length,
    saved: 0,
    available: 0,
    missing: 0,
    errors: [],
    stopped: false,
  };

  for (const source of sources) {
    if (result.stopped) {
      break;
    }
    try {
      const closest = await checkAvailability(source.url, limits.timeoutMs);
      const captures = await listCaptures(source.url, limits.timeoutMs, limits.maxCaptures);
      const chosen = chooseCaptures(captures, closest, source.url, limits.maxCaptures);
      const existing = new Set(await listArchiveUrls(source.id));
      for (const capture of chosen) {
        if (existing.has(capture.archiveUrl)) {
          continue;
        }
        const capturedAt = waybackTimestampToDate(capture.timestamp);
        if (!capturedAt) {
          continue;
        }
        const availabilityStatus = await probeArchive(capture.archiveUrl, limits.timeoutMs);
        await createArchiveCapture({
          investigationId,
          sourceId: source.id,
          archiveUrl: capture.archiveUrl,
          originalUrl: source.url,
          capturedAt,
          availabilityStatus,
        });
        existing.add(capture.archiveUrl);
        result.saved += 1;
        if (availabilityStatus === "available") {
          result.available += 1;
        }
        if (availabilityStatus === "missing") {
          result.missing += 1;
        }
      }
    } catch (error) {
      const stop = error instanceof WaybackRequestError ? error.stop : false;
      result.errors.push(error instanceof Error ? error.message : "Wayback request failed.");
      result.stopped = stop;
    }
  }

  return result;
}

export function describeArchiveComparison(input: {
  observationAccessible: boolean;
  observationWhen: string | null;
  observationTitle: string | null;
  observationStatus: number | null;
  captureAvailable: boolean;
  capturedAt: string;
}): string | null {
  if (!input.captureAvailable || !input.observationAccessible) {
    return null;
  }
  const title = input.observationTitle ? `: ${input.observationTitle}` : "";
  const status = input.observationStatus != null ? ` (HTTP ${input.observationStatus})` : "";
  const when = input.observationWhen ? ` on ${input.observationWhen}` : "";
  return `Current observation${when}${title}${status}. Archived copy captured ${input.capturedAt}. The archive link is the original capture, not a summary.`;
}
