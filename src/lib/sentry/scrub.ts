const secretPattern =
  /(?:postgres(?:ql)?:\/\/\S+|wss?:\/\/\S+|https?:\/\/[^\s]*browserbase[^\s]*|https?:\/\/[^\s]*ingest\.sentry\.io\S*|(?:api[_-]?key|token|authorization|xi-api-key|signingKey|password|pwd)\s*[=:]\s*\S+)/gi;

export function scrubText(value: string): string {
  const cleaned = value.replace(secretPattern, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 280);
  return cleaned || "The operation failed.";
}

export type SentryEventLike = {
  message?: string;
  request?: unknown;
  extra?: unknown;
  breadcrumbs?: unknown;
  contexts?: Record<string, unknown> | undefined;
  exception?: {
    values?: Array<{ value?: string; type?: string }>;
  };
};

export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  delete event.request;
  delete event.extra;
  delete event.breadcrumbs;
  if (event.message) {
    event.message = scrubText(event.message);
  }
  for (const entry of event.exception?.values ?? []) {
    if (entry.value) {
      entry.value = scrubText(entry.value);
    }
  }
  if (event.contexts) {
    delete event.contexts.prompt;
    delete event.contexts.response;
  }
  return event;
}
