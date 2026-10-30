"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/panel";
import type { DiscoveryRun } from "@/lib/discovery/types";

type Lead = {
  id: string;
  title: string | null;
  url: string;
};

export function DiscoveryPanel({
  investigationId,
  disabled,
  leads,
}: {
  investigationId: string;
  disabled: boolean;
  leads: Lead[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<DiscoveryRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDiscovery() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${investigationId}/discover`, {
        method: "POST",
      });
      const body = (await response.json()) as DiscoveryRun & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Discovery failed.");
        return;
      }
      setProgress(body);
      router.refresh();
    } catch {
      setError("Discovery failed before a result was returned.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Search leads</p>
          <h2 className="font-serif text-lg">Discovery</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            A search result is a research lead, not a confirmed finding. Snippets are not saved as evidence.
          </p>
        </div>
        <button
          type="button"
          className={buttonClass()}
          disabled={disabled || pending}
          onClick={runDiscovery}
        >
          {pending ? "Searching…" : "Run discovery"}
        </button>
      </div>
      {disabled ? (
        <p className="mt-3 text-sm text-muted">Discovery is not run for the sample layout.</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {progress ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Queries</dt>
            <dd className="font-serif text-2xl">{progress.queries.length}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Saved leads</dt>
            <dd className="font-serif text-2xl">{progress.saved.length}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Duplicates</dt>
            <dd className="font-serif text-2xl">{progress.skippedDuplicates}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Unresolved links</dt>
            <dd className="font-serif text-2xl">{progress.skippedWithoutDestination}</dd>
          </div>
        </dl>
      ) : null}
      {progress?.errors.length ? (
        <ul className="mt-3 space-y-1">
          {progress.errors.map((item) => (
            <li key={item.query} className="text-sm text-danger">
              {item.query}: {item.message}
            </li>
          ))}
        </ul>
      ) : null}
      {progress?.saved.length ? (
        <ul className="mt-4 space-y-3">
          {progress.saved.map((lead) => (
            <li key={lead.id} className="min-w-0 border-t border-line pt-3">
              <p className="text-sm text-foreground">{lead.title}</p>
              <p className="truncate text-xs text-muted">{lead.displayedUrl}</p>
              {lead.snippet ? (
                <p className="mt-1 text-sm leading-6 text-muted">Unverified snippet: {lead.snippet}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!progress && leads.length > 0 ? (
        <p className="mt-3 text-sm text-muted">{leads.length} search leads are already stored for this record.</p>
      ) : null}
    </section>
  );
}
