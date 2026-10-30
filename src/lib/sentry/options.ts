import type { ErrorEvent, TransactionEvent } from "@sentry/core";
import { scrubSentryEvent } from "./scrub";

export function readSentryDsn(): string | undefined {
  const value = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim();
  return value || undefined;
}

export function sentryInitOptions() {
  return {
    dsn: readSentryDsn(),
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
    dataCollection: {
      userInfo: false,
      cookies: false as const,
      httpHeaders: false as const,
      httpBodies: [] as [],
      urlQueryParams: false as const,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    beforeSend(event: ErrorEvent) {
      scrubSentryEvent(event);
      return event;
    },
    beforeSendTransaction(event: TransactionEvent) {
      scrubSentryEvent(event);
      return event;
    },
  };
}
