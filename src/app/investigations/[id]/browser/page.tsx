import { Suspense } from "react";
import Link from "next/link";
import { CloudBrowser } from "@/components/investigation/cloud-browser";
import { RecordError, resolveInvestigation } from "../record";

export const metadata = { title: "Cloud browser" };

export default function CloudBrowserPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-4 text-sm text-muted">Opening the cloud browser…</p>}>
      <BrowserContent params={params} />
    </Suspense>
  );
}

async function BrowserContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await resolveInvestigation(id, "/browser");
  if ("error" in record) {
    return <RecordError message={record.error} />;
  }

  return (
    <div className="case-browser-page flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
      <header className="case-browser-heading flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="case-eyebrow">Field station <span>/</span> temporary connection</p>
          <h1 className="mt-1 truncate font-serif text-2xl tracking-tight">{record.title}</h1>
        </div>
        <Link href={`/investigations/${record.id}`} className="case-return-link">
          Return to case file
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <CloudBrowser
          investigationId={record.id}
          startingUrl={record.startingUrl}
          disabled={record.mode === "sample"}
          fill
        />
      </div>
    </div>
  );
}
