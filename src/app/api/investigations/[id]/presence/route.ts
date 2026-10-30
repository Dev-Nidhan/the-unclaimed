import { connection } from "next/server";
import { z } from "zod";
import { presenceEventIds } from "@/lib/presence/events";
import { recordPresenceEvent } from "@/lib/db/queries";
import { redactDatabaseError } from "@/lib/redact";
import { reportOperationFailure } from "@/lib/sentry/report";

const bodySchema = z.object({
  eventType: z.enum(presenceEventIds),
  intensity: z.number().int().min(0).max(100),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Investigation not found." }, { status: 404 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "The event could not be read." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "The event could not be read." }, { status: 400 });
  }
  await connection();
  try {
    const created = await recordPresenceEvent({
      investigationId: id,
      eventType: parsed.data.eventType,
      intensity: parsed.data.intensity,
    });
    if (!created) {
      return Response.json({ error: "Investigation not found." }, { status: 404 });
    }
    return Response.json({ id: created.id, triggeredAt: created.triggeredAt }, { status: 201 });
  } catch (error) {
    reportOperationFailure("tiger-data", error, id);
    return Response.json({ error: redactDatabaseError(error) }, { status: 503 });
  }
}
