"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { createInvestigation } from "@/lib/db/queries";
import { parseInvestigationStart } from "@/lib/investigations/start";
import { redactDatabaseError } from "@/lib/redact";
import { reportOperationFailure } from "@/lib/sentry/report";

export type StartInvestigationState = { error: string } | null;

export async function startInvestigation(
  _previous: StartInvestigationState,
  formData: FormData,
): Promise<StartInvestigationState> {
  const parsed = parseInvestigationStart({
    title: String(formData.get("title") ?? ""),
    starting: String(formData.get("starting") ?? ""),
    objective: String(formData.get("objective") ?? ""),
  });

  if (!parsed.ok) {
    return { error: parsed.error };
  }

  try {
    const created = await createInvestigation({
      title: parsed.title,
      subject: parsed.subject,
      startingUrl: parsed.startingUrl,
      objective: parsed.objective,
    });
    redirect(`/investigations/${created.id}`);
  } catch (error) {
    unstable_rethrow(error);
    reportOperationFailure("investigation", error);
    return { error: redactDatabaseError(error) };
  }
}
