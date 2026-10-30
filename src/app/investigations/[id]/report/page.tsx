import { Suspense } from "react";
import { ArchiveReport } from "@/components/investigation/archive-report";
import { RecordError, resolveInvestigation } from "../record";

export const metadata = { title: "Archive report" };

export default function ArchiveReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Opening the archive…</p>}>
      <ReportContent params={params} />
    </Suspense>
  );
}

async function ReportContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await resolveInvestigation(id, "/report");
  if ("error" in record) {
    return <RecordError message={record.error} />;
  }
  return <ArchiveReport view={record} />;
}
