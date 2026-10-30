export type WaybackCapture = {
  timestamp: string;
  originalUrl: string;
  archiveUrl: string;
  statusCode: string | null;
};

export type AvailabilitySnapshot = {
  available: boolean;
  url: string;
  timestamp: string;
  status: string;
};

const availabilityEndpoint = "https://archive.org/wayback/available";
const cdxEndpoint = "https://web.archive.org/cdx/search/cdx";

export class WaybackRequestError extends Error {
  readonly status: number | null;
  readonly retryAfter: string | null;
  readonly stop: boolean;

  constructor(message: string, status: number | null, retryAfter: string | null, stop: boolean) {
    super(message);
    this.name = "WaybackRequestError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.stop = stop;
  }
}

export function waybackTimestampToDate(timestamp: string): Date | null {
  if (!/^\d{14}$/.test(timestamp)) {
    return null;
  }
  const year = Number(timestamp.slice(0, 4));
  const month = Number(timestamp.slice(4, 6));
  const day = Number(timestamp.slice(6, 8));
  const hour = Number(timestamp.slice(8, 10));
  const minute = Number(timestamp.slice(10, 12));
  const second = Number(timestamp.slice(12, 14));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildArchiveUrl(timestamp: string, originalUrl: string): string | null {
  if (!/^\d{14}$/.test(timestamp)) {
    return null;
  }
  try {
    const original = new URL(originalUrl);
    if (original.protocol !== "http:" && original.protocol !== "https:") {
      return null;
    }
    return `https://web.archive.org/web/${timestamp}/${original.toString()}`;
  } catch {
    return null;
  }
}

export function parseAvailability(payload: unknown): AvailabilitySnapshot | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const closest = (payload as { archived_snapshots?: { closest?: unknown } }).archived_snapshots?.closest;
  if (!closest || typeof closest !== "object") {
    return null;
  }
  const snapshot = closest as Record<string, unknown>;
  if (snapshot.available !== true || typeof snapshot.url !== "string" || typeof snapshot.timestamp !== "string") {
    return null;
  }
  return {
    available: true,
    url: snapshot.url,
    timestamp: snapshot.timestamp,
    status: typeof snapshot.status === "string" ? snapshot.status : "",
  };
}

export function parseCdx(payload: unknown): WaybackCapture[] {
  if (!Array.isArray(payload) || payload.length < 2) {
    return [];
  }
  const header = payload[0];
  if (!Array.isArray(header) || !header.every((field) => typeof field === "string")) {
    return [];
  }
  const fields = header as string[];
  const captures: WaybackCapture[] = [];
  for (const row of payload.slice(1)) {
    if (!Array.isArray(row) || row.length !== fields.length) {
      continue;
    }
    const record = Object.fromEntries(fields.map((field, index) => [field, String(row[index] ?? "")]));
    const archiveUrl = buildArchiveUrl(record.timestamp ?? "", record.original ?? "");
    if (!archiveUrl || !record.original) {
      continue;
    }
    captures.push({
      timestamp: record.timestamp ?? "",
      originalUrl: record.original,
      archiveUrl,
      statusCode: record.statuscode || null,
    });
  }
  return captures;
}

export function chooseCaptures(
  captures: WaybackCapture[],
  closest: AvailabilitySnapshot | null,
  originalUrl: string,
  limit: number,
): WaybackCapture[] {
  const chosen: WaybackCapture[] = [];
  const seen = new Set<string>();
  const add = (capture: WaybackCapture) => {
    if (!capture.archiveUrl.startsWith("http") || seen.has(capture.archiveUrl) || chosen.length >= limit) {
      return;
    }
    seen.add(capture.archiveUrl);
    chosen.push(capture);
  };

  if (closest?.available && closest.url.startsWith("http")) {
    add({
      timestamp: closest.timestamp,
      originalUrl,
      archiveUrl: closest.url,
      statusCode: closest.status || null,
    });
  }

  const dated = captures
    .map((capture) => ({ capture, date: waybackTimestampToDate(capture.timestamp) }))
    .filter((item): item is { capture: WaybackCapture; date: Date } => item.date !== null)
    .sort((left, right) => right.date.getTime() - left.date.getTime());
  for (const item of dated) {
    add(item.capture);
  }
  return chosen;
}

async function waybackGet(url: URL, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { "user-agent": "TheUnclaimedArchaeology/1.0", accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new WaybackRequestError(timedOut ? "Wayback timed out." : "Wayback request failed.", null, null, false);
  }
}

function failedResponse(response: Response): WaybackRequestError {
  const stop = response.status === 429 || response.status === 503;
  return new WaybackRequestError(
    stop ? "Wayback rate limit reached." : `Wayback returned ${response.status}.`,
    response.status,
    response.headers.get("retry-after"),
    stop,
  );
}

export async function checkAvailability(url: string, timeoutMs: number): Promise<AvailabilitySnapshot | null> {
  const endpoint = new URL(availabilityEndpoint);
  endpoint.searchParams.set("url", url);
  const response = await waybackGet(endpoint, timeoutMs);
  if (!response.ok) {
    throw failedResponse(response);
  }
  return parseAvailability(await response.json());
}

export async function listCaptures(url: string, timeoutMs: number, limit: number): Promise<WaybackCapture[]> {
  const endpoint = new URL(cdxEndpoint);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("output", "json");
  endpoint.searchParams.set("fl", "timestamp,original,statuscode,mimetype");
  endpoint.searchParams.set("filter", "statuscode:200");
  endpoint.searchParams.set("collapse", "timestamp:4");
  endpoint.searchParams.set("limit", String(limit));
  const response = await waybackGet(endpoint, timeoutMs);
  if (!response.ok) {
    throw failedResponse(response);
  }
  return parseCdx(await response.json());
}
