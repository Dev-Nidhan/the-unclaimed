import { z } from "zod";
import { cancelFieldwork, fieldworkProgress } from "@/lib/archaeology/progress";
import { runFieldwork } from "@/lib/archaeology/run";
import { getInvestigationById } from "@/lib/db/queries";

const command = z.object({
  action: z.enum(["start", "cancel"]),
});

async function investigationOrNull(id: string) {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  return getInvestigationById(id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const investigation = await investigationOrNull(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  return Response.json(fieldworkProgress(investigation.id));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const investigation = await investigationOrNull(id);
  if (!investigation) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The fieldwork command was not valid." }, { status: 400 });
  }
  const parsed = command.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The fieldwork command was not valid." }, { status: 400 });
  }

  if (parsed.data.action === "cancel") {
    return Response.json(cancelFieldwork(investigation.id));
  }

  const current = fieldworkProgress(investigation.id);
  if (current.status === "running" || current.status === "cancelling") {
    return Response.json(current);
  }

  void runFieldwork(investigation.id).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Fieldwork failed.";
    if (message.includes("already running")) {
      return;
    }
    cancelFieldwork(investigation.id);
  });

  return Response.json(fieldworkProgress(investigation.id));
}
