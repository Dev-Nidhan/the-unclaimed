import { z } from "zod";
import { recoverSourceArchives } from "@/lib/archive/recover";
import { getInvestigationById } from "@/lib/db/queries";
import { scrubText } from "@/lib/sentry/scrub";
import { reportOperationFailure, traceOperation } from "@/lib/sentry/report";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  const investigation = await getInvestigationById(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  try {
    return Response.json(
      await traceOperation(
        { name: "Archive lookup", operation: "wayback", investigationId: investigation.id },
        () => recoverSourceArchives(investigation.id),
      ),
    );
  } catch (error) {
    reportOperationFailure("wayback", error, id);
    return Response.json({ error: scrubText(error instanceof Error ? error.message : "Wayback recovery failed.") }, { status: 502 });
  }
}
