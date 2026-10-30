import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowDown, ArrowUpRight, AudioLines, Fingerprint, ScanSearch } from "lucide-react";
import { DashboardAmbience } from "@/components/audio/dashboard-ambience";
import { EmptyState, Panel } from "@/components/ui/panel";
import { formatTimestamp, loadDashboardRecords } from "@/lib/investigations/load";

export const metadata = { title: "The Archive" };

function CatalogFallback() {
  return <p className="text-sm text-muted">The archive is waking…</p>;
}

async function Catalog() {
  await connection();
  const records = await loadDashboardRecords();

  if (!records.ok) {
    return (
      <Panel title="The archive is out of reach" eyebrow="Connection lost">
        <p role="alert" className="text-sm leading-6 text-danger">{records.message}</p>
        <p className="mt-2 text-sm leading-6 text-muted">Stored records will return when the archive can be reached.</p>
      </Panel>
    );
  }

  const stats = [
    ["Investigations", records.counts.investigations],
    ["Sources recovered", records.counts.sources],
    ["Observations", records.counts.observations],
    ["Findings", records.counts.findings],
  ] as const;

  return (
    <div className="archive-catalog">
      <div className="archive-section-heading">
        <div>
          <p className="eyebrow">What remains</p>
          <h2 className="font-serif text-3xl">The record room</h2>
        </div>
        <span className="archive-count">{String(records.counts.investigations).padStart(2, "0")} FILES</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recovered inventory" eyebrow="Archive index">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-6">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.65rem] tracking-[0.14em] text-muted uppercase">{label}</dt>
                <dd className="mt-1 font-serif text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Open case files" eyebrow="Recently touched">
          {records.investigations.length === 0 ? (
            <EmptyState title="The shelves are empty" detail="Start with a URL. We will follow its traces and preserve what we find." />
          ) : (
            <ul className="space-y-3">
              {records.investigations.map((investigation) => (
                <li key={investigation.id}>
                  <Link href={`/investigations/${investigation.id}`} className="archive-record-link">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">{investigation.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted">{investigation.status} · {formatTimestamp(investigation.updatedAt)}</span>
                    </span>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-amber" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Fragments recovered" eyebrow="Recent observations">
          {records.observations.length === 0 ? (
            <EmptyState title="Nothing has surfaced" detail="Saved observations will appear here as evidence is collected." />
          ) : (
            <ul className="space-y-3">
              {records.observations.map((observation) => (
                <li key={observation.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="text-sm">{observation.pageTitle ?? "Untitled observation"}</p>
                  <p className="mt-1 text-xs text-muted">{formatTimestamp(observation.observedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Source traces" eyebrow="Recovered references">
          {records.sources.length === 0 ? (
            <EmptyState title="No sources in the ledger" detail="Sources collected during an investigation will be listed here." />
          ) : (
            <ul className="space-y-3">
              {records.sources.map((source) => (
                <li key={source.id} className="min-w-0 border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="truncate text-sm">{source.title ?? source.url}</p>
                  <p className="mt-1 truncate text-xs text-muted">{source.url}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function ArchivePage() {
  return (
    <div className="archive-home">
      <DashboardAmbience />
      <section className="archive-hero" aria-labelledby="archive-title">
        <div className="archive-hero-copy">
          <p className="eyebrow"><span className="status-light" /> Digital archaeology <span className="eyebrow-divider">/</span> Field desk 001</p>
          <h1 id="archive-title" className="archive-title">The internet<br /><em>forgets.</em><br />We don’t.</h1>
          <p className="archive-intro">Abandoned projects, vanished pages, stories left between the links. Follow their traces, recover what remains, and piece together what happened.</p>
          <div className="archive-actions">
            <Link href="/investigations/new" className="archive-begin">
              <span>Begin an investigation</span><ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
            <span className="archive-action-note">One URL is enough to start.</span>
          </div>
          <div className="archive-scroll-cue"><ArrowDown aria-hidden="true" className="size-3" /> DESCEND INTO THE ARCHIVE</div>
        </div>
        <div className="archive-hero-art" aria-hidden="true">
          <div className="archive-orbit archive-orbit-one" />
          <div className="archive-orbit archive-orbit-two" />
          <div className="archive-artifact">
            <div className="artifact-topline"><span>RECOVERED SIGNAL</span><span>01 / 03</span></div>
            <div className="artifact-symbol"><Fingerprint strokeWidth={0.75} /></div>
            <p className="artifact-coordinate">FREQUENCY LOST · ORIGIN UNRESOLVED</p>
            <div className="artifact-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <p className="artifact-caption">A trace is not a conclusion.</p>
          </div>
          <span className="artifact-side-note">SIGNAL FOUND<br />SOURCE UNKNOWN</span>
          <span className="artifact-vertical">THE UNCLAIMED · DIGITAL ARCHAEOLOGY</span>
        </div>
        <div className="archive-hero-foot"><span>CASEWORK / 00—∞</span><span>THE RECORD IS INCOMPLETE BY NATURE</span><span>EST. IN THE AFTERMATH</span></div>
      </section>

      <section className="archive-method" aria-label="How the archive works">
        <div className="archive-method-intro">
          <p className="eyebrow">Three things happen here</p>
          <p className="font-serif text-2xl leading-tight">A careful search.<br />An uneasy silence.</p>
        </div>
        <article className="archive-method-card">
          <span className="method-number">01</span><ScanSearch aria-hidden="true" className="method-icon" />
          <h2>Recover</h2><p>Search the living web and old archives for things that disappeared.</p>
        </article>
        <article className="archive-method-card">
          <span className="method-number">02</span><Fingerprint aria-hidden="true" className="method-icon" />
          <h2>Connect</h2><p>Gather evidence, follow references, and reconstruct a digital history.</p>
        </article>
        <article className="archive-method-card">
          <span className="method-number">03</span><AudioLines aria-hidden="true" className="method-icon" />
          <h2>Listen</h2><p>An optional, independent presence can stir inside the archive. It never guides the investigation.</p>
        </article>
      </section>

      <section className="starter-file">
        <div className="starter-file-mark">STARTER<br />FILE</div>
        <div className="starter-file-copy">
          <p className="eyebrow">A record already in custody</p>
          <h2 className="font-serif text-2xl">The first website</h2>
          <p>Open a stored investigation of info.cern.ch, an early website. The observation is the text read from that live page, not a placeholder or a finding.</p>
        </div>
        <Link href="/investigations/sample" className="starter-file-link">Enter the file <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
      </section>

      <Suspense fallback={<CatalogFallback />}><Catalog /></Suspense>
      <footer className="archive-footer"><span>THE UNCLAIMED</span><span>Some things are still out there.</span></footer>
    </div>
  );
}
