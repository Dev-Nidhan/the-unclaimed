export type DiscoveryInput = {
  investigationId: string;
  subject: string;
  startingUrl?: string;
  objective: string;
  shouldStop?: () => boolean;
};

export type SearchLead = {
  title: string;
  url: string;
  canonicalUrl: string;
  displayedUrl: string;
  snippet: string;
  query: string;
  discoveredAt: string;
};

export type SavedSearchLead = SearchLead & {
  id: string;
};

export type DiscoveryQueryError = {
  query: string;
  message: string;
  status: number | null;
};

export type DiscoveryRun = {
  investigationId: string;
  queries: string[];
  saved: SavedSearchLead[];
  skippedDuplicates: number;
  errors: DiscoveryQueryError[];
  stopped: boolean;
  skippedWithoutDestination: number;
};

export type SearchLimits = {
  maxQueries: number;
  resultsPerQuery: number;
  timeoutMs: number;
};

export const searchLeadType = "search_lead";
export const searchDiscoveryMethod = "search";
