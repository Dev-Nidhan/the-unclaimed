import { z } from "zod";
import { getInvestigationById } from "@/lib/db/queries";
import { artifactKinds } from "@/lib/storage/files";
import {
  listInvestigationArtifacts,
  removeInvestigationArtifact,
  storeInvestigationArtifact,
} from "@/lib/storage/service";
import { scrubText } from "@/lib/sentry/scrub";

async function investigationOrNull(id: string) {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  return getInvestigationById(id);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const investigation = await investigationOrNull(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  try {
    return Response.json({ artifacts: await listInvestigationArtifacts(investigation.id) });
  } catch (error) {
    return Response.json({ error: scrubText(error instanceof Error ? error.message : "Artifacts could not be listed.") }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const investigation = await investigationOrNull(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "The upload could not be read." }, { status: 400 });
  }
  const file = form.get("file");
  const sourceId = String(form.get("sourceId") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File) || !z.uuid().safeParse(sourceId).success || !artifactKinds.includes(kind as (typeof artifactKinds)[number])) {
    return Response.json({ error: "Choose a source, a file, and an artifact type." }, { status: 400 });
  }
  try {
    const saved = await storeInvestigationArtifact({
      investigationId: investigation.id,
      sourceId,
      kind,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return Response.json(
      {
        id: saved.id,
        filename: saved.filename,
        mimeType: saved.mimeType,
        sourceId: saved.sourceId,
        createdAt: saved.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ error: scrubText(error instanceof Error ? error.message : "The file could not be stored.") }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const investigation = await investigationOrNull(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  const artifactId = new URL(request.url).searchParams.get("artifactId") ?? "";
  if (!z.uuid().safeParse(artifactId).success) {
    return Response.json({ error: "Artifact not found." }, { status: 404 });
  }
  try {
    const removed = await removeInvestigationArtifact(investigation.id, artifactId);
    if (!removed) {
      return Response.json({ error: "Artifact not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: scrubText(error instanceof Error ? error.message : "The file could not be removed.") }, { status: 502 });
  }
}
