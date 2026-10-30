import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Panel } from "@/components/ui/panel";
import { loadStoredInvestigation } from "@/lib/investigations/load";
import { ensureStarterInvestigation } from "@/lib/investigations/starter";
import type { InvestigationView } from "@/lib/investigations/types";

export async function resolveInvestigation(
  id: string,
  suffix = "",
): Promise<InvestigationView | { error: string }> {
  if (id === "sample") {
    const storedId = await ensureStarterInvestigation();
    redirect(`/investigations/${storedId}${suffix}`);
  }

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  await connection();
  const result = await loadStoredInvestigation(id);
  if (!result.ok && "missing" in result && result.missing) {
    notFound();
  }
  if (!result.ok) {
    return { error: "message" in result ? result.message : "The record could not be read." };
  }
  return result.view;
}

export function RecordError({ message }: { message: string }) {
  return (
    <Panel title="Record unavailable" eyebrow="Database">
      <p role="alert" className="text-sm leading-6 text-danger">
        {message}
      </p>
    </Panel>
  );
}
