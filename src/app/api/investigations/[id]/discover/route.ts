import { z } from "zod";
import { getInvestigationById } from "@/lib/db/queries";
import { discoverSources } from "@/lib/discovery/run";
import { redactSearchError } from "@/lib/discovery/serpapi";
import { redactDatabaseError } from "@/lib/redact";
import { reportOperationFailure, traceOperation } from "@/lib/sentry/report";

function publicError(error: unknown): string {
  return redactDatabaseError(new Error(redactSearchError(error)));
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }

  try {
    const investigation = await getInvestigationById(id);
    if (!investigation) {
      return Response.json({ error: "Investigation not found." }, { status: 404 });
    }

    const result = await traceOperation(
      { name: "Discover sources", operation: "serpapi", investigationId: investigation.id },
      () =>
        discoverSources({
          investigationId: investigation.id,
          subject: investigation.subject,
          startingUrl: investigation.startingUrl,
          objective: investigation.objective,
        }),
    );
    return Response.json(result);
  } catch (error) {
    reportOperationFailure("serpapi", error, id);
    const message = publicError(error);
    const status = message === "SERPAPI_API_KEY is not set." ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
