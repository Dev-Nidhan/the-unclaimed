export function redactSearchError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Search request failed.";
  return message.replace(/api_key=[^&\s]+/gi, "api_key=[redacted]");
}

export class SearchRequestError extends Error {
  readonly status: number | null;
  readonly retryAfter: string | null;
  readonly stop: boolean;

  constructor(message: string, status: number | null, retryAfter: string | null, stop: boolean) {
    super(message);
    this.name = "SearchRequestError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.stop = stop;
  }
}

export type OrganicHit = {
  title: string;
  link: string;
  displayedLink: string;
  snippet: string;
};

type SerpApiPayload = {
  error?: unknown;
  organic_results?: unknown;
};

function readOrganic(value: unknown): OrganicHit | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.title !== "string" || typeof row.link !== "string") {
    return null;
  }
  return {
    title: row.title.trim(),
    link: row.link,
    displayedLink: typeof row.displayed_link === "string" ? row.displayed_link : row.link,
    snippet: typeof row.snippet === "string" ? row.snippet.trim() : "",
  };
}

export async function searchGoogle(input: {
  query: string;
  apiKey: string;
  timeoutMs: number;
}): Promise<OrganicHit[]> {
  const endpoint = new URL("https://serpapi.com/search.json");
  endpoint.searchParams.set("engine", "google");
  endpoint.searchParams.set("q", input.query);
  endpoint.searchParams.set("api_key", input.apiKey);

  let response: Response;
  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(input.timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new SearchRequestError(
      timedOut ? "SerpApi timed out." : redactSearchError(error),
      null,
      null,
      false,
    );
  }

  let payload: SerpApiPayload | null = null;
  try {
    payload = (await response.json()) as SerpApiPayload;
  } catch {
    payload = null;
  }

  const providerError = typeof payload?.error === "string" ? payload.error : null;
  if (!response.ok || providerError) {
    const stop = response.status === 401 || response.status === 403 || response.status === 429;
    const message = providerError ?? `SerpApi returned ${response.status}.`;
    throw new SearchRequestError(message, response.status, response.headers.get("retry-after"), stop);
  }

  if (!Array.isArray(payload?.organic_results)) {
    return [];
  }
  return payload.organic_results.flatMap((item) => {
    const hit = readOrganic(item);
    return hit ? [hit] : [];
  });
}
