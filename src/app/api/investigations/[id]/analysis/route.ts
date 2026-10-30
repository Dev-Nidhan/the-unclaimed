import { z } from "zod";
import { analysisProgress } from "@/lib/ai/progress";
import { runAnalysis } from "@/lib/ai/run";
import { getInvestigationById } from "@/lib/db/queries";

export async function GET(
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
  return Response.json(analysisProgress(investigation.id));
}

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
  const current = analysisProgress(investigation.id);
  if (current.status === "running") {
    return Response.json(current);
  }
  void runAnalysis(investigation.id).catch(() => undefined);
  return Response.json(analysisProgress(investigation.id));
}
