import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { EvidenceBoard } from "@/components/investigation/evidence-graph";
import { loadEvidenceModel } from "@/lib/investigations/load";
import { ensureStarterInvestigation } from "@/lib/investigations/starter";
import { RecordError } from "../record";

export const metadata = { title: "Evidence graph" };

export default function EvidenceGraphPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Opening the archive…</p>}>
      <GraphContent params={params} />
    </Suspense>
  );
}

async function GraphContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "sample") {
    const storedId = await ensureStarterInvestigation();
    redirect(`/investigations/${storedId}/graph`);
  }
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const result = await loadEvidenceModel(id);
  if (!result.ok && result.missing) {
    notFound();
  }
  if (!result.ok) {
    return <RecordError message={result.message} />;
  }

  return (
    <div className="case-graph-page space-y-4">
      <GraphHeader />
      <EvidenceBoard model={result.model} />
    </div>
  );
}

function GraphHeader() {
  return (
    <header className="case-graph-heading">
      <p className="case-eyebrow">Evidence map <span>/</span> stored connections</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight">Follow what remains.</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        Every card is a stored source, archive record, or entity. Select one to inspect its saved excerpt and linked evidence. Drag to move through the map; zoom in to follow a trail.
      </p>
      <div className="case-graph-instructions"><span><i>01</i> SELECT A RECORD</span><span><i>02</i> READ ITS TRACE</span><span><i>03</i> FOLLOW A DOCUMENTED LINK</span></div>
    </header>
  );
}
