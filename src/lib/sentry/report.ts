import * as Sentry from "@sentry/nextjs";
import { scrubText } from "./scrub";

export async function traceOperation<T>(
  input: { name: string; operation: string; investigationId?: string },
  run: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name: input.name,
      op: input.operation,
      attributes: {
        "investigation.id": input.investigationId ?? "none",
        "operation.type": input.operation,
      },
    },
    run,
  );
}

export function reportOperationFailure(operation: string, error: unknown, investigationId?: string): void {
  const safe = new Error(scrubText(error instanceof Error ? error.message : "The operation failed."));
  safe.name = "IntegrationError";
  if (error instanceof Error && error.stack && !error.stack.includes("postgres://") && !error.stack.includes("wss://")) {
    safe.stack = error.stack;
  }
  Sentry.withScope((scope) => {
    scope.setTag("operation", operation);
    if (investigationId && /^[0-9a-f-]{36}$/i.test(investigationId)) {
      scope.setTag("investigation_id", investigationId);
    }
    Sentry.captureException(safe);
  });
}
