import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { createSource } from "../db/queries";
import { sources } from "../db/schema";
import { canonicalizeUrl, selectDestinationUrl } from "./canonicalize";
import { readSearchLimits, requireSerpApiKey } from "./config";
import { buildSearchQueries } from "./queries";
import { searchGoogle, SearchRequestError } from "./serpapi";
import {
  searchDiscoveryMethod,
  searchLeadType,
  type DiscoveryInput,
  type DiscoveryRun,
  type SavedSearchLead,
} from "./types";

async function storedCanonicalUrls(investigationId: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ canonicalUrl: sources.canonicalUrl })
    .from(sources)
    .where(eq(sources.investigationId, investigationId));
  return new Set(rows.map((row) => row.canonicalUrl));
}

export async function discoverSources(input: DiscoveryInput): Promise<DiscoveryRun> {
  const apiKey = requireSerpApiKey();
  const limits = readSearchLimits();
  const queries = buildSearchQueries(input, limits.maxQueries);
  const seen = await storedCanonicalUrls(input.investigationId);
  const saved: SavedSearchLead[] = [];
  const errors: DiscoveryRun["errors"] = [];
  let skippedDuplicates = 0;
  let skippedWithoutDestination = 0;
  let stopped = false;

  for (const query of queries) {
    if (stopped || input.shouldStop?.()) {
      break;
    }

    let hits;
    try {
      hits = await searchGoogle({ query, apiKey, timeoutMs: limits.timeoutMs });
    } catch (error) {
      const stop = error instanceof SearchRequestError ? error.stop : false;
      const status = error instanceof SearchRequestError ? error.status : null;
      const message =
        error instanceof SearchRequestError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Search request failed.";
      errors.push({ query, message, status });
      stopped = stop;
      continue;
    }

    const discoveredAt = new Date().toISOString();
    for (const hit of hits.slice(0, limits.resultsPerQuery)) {
      const destination = selectDestinationUrl(hit.link, hit.displayedLink);
      const canonicalUrl = destination ? canonicalizeUrl(destination) : null;
      if (!destination || !canonicalUrl || !hit.title) {
        skippedWithoutDestination += 1;
        continue;
      }
      if (seen.has(canonicalUrl)) {
        skippedDuplicates += 1;
        continue;
      }

      try {
        const source = await createSource({
          investigationId: input.investigationId,
          url: destination,
          canonicalUrl,
          title: hit.title,
          sourceType: searchLeadType,
          discoveryMethod: searchDiscoveryMethod,
          accessStatus: "unknown",
        });
        seen.add(canonicalUrl);
        saved.push({
          id: source.id,
          title: source.title ?? hit.title,
          url: source.url,
          canonicalUrl: source.canonicalUrl,
          displayedUrl: hit.displayedLink,
          snippet: hit.snippet,
          query,
          discoveredAt,
        });
      } catch (error) {
        errors.push({
          query,
          message: error instanceof Error ? error.message : "The search lead could not be stored.",
          status: null,
        });
        stopped = true;
        break;
      }
    }
  }

  return {
    investigationId: input.investigationId,
    queries,
    saved,
    skippedDuplicates,
    skippedWithoutDestination,
    errors,
    stopped,
  };
}
