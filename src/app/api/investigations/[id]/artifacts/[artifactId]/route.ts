import { z } from "zod";
import { getInvestigationById } from "@/lib/db/queries";
import { openInvestigationArtifact } from "@/lib/storage/service";
import { scrubText } from "@/lib/sentry/scrub";

export async function GET(_request: Request, context: { params: Promise<{ id: string; artifactId: string }> }) {
  const { id, artifactId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(artifactId).success) {
    return Response.json({ error: "Artifact not found." }, { status: 404 });
  }
  const investigation = await getInvestigationById(id);
  if (!investigation) {
    return Response.json({ error: "Artifact not found." }, { status: 404 });
  }
  try {
    const opened = await openInvestigationArtifact(investigation.id, artifactId);
    if (!opened) {
      return Response.json({ error: "Artifact not found." }, { status: 404 });
    }
    if (opened.kind === "redirect") {
      return Response.redirect(opened.url, 302);
    }
    return new Response(new Uint8Array(opened.bytes), {
      headers: {
        "content-type": opened.mimeType,
        "content-disposition": `attachment; filename="${opened.filename.replace(/"/g, "")}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: scrubText(error instanceof Error ? error.message : "The file could not be opened.") }, { status: 502 });
  }
}
