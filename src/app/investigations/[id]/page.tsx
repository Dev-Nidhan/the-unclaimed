import { Suspense } from "react";
import { RecordError, resolveInvestigation } from "./record";
import { WorkspaceView } from "@/components/investigation/workspace-view";

export const metadata = { title: "Workspace" };

export default function InvestigationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Opening the archive…</p>}>
      <WorkspaceContent params={params} />
    </Suspense>
  );
}

async function WorkspaceContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await resolveInvestigation(id);
  if ("error" in record) {
    return <RecordError message={record.error} />;
  }
  return <WorkspaceView view={record} />;
}
