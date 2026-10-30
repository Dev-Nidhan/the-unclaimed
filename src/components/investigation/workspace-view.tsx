import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AnalysisPanel } from "@/components/investigation/analysis-panel";
import { BeginInvestigationAudio } from "@/components/investigation/begin-investigation-audio";
import { ArchiveLookup } from "@/components/investigation/archive-lookup";
import { ArtifactPanel } from "@/components/investigation/artifact-panel";
import { DiscoveryPanel } from "@/components/investigation/discovery-panel";
import { FieldworkPanel } from "@/components/investigation/fieldwork-panel";
import { CaseOpening, EvidenceArrivalNotice } from "@/components/investigation/case-moments";
import { EmptyState, Panel, SampleBanner } from "@/components/ui/panel";
import { describeArchiveComparison } from "@/lib/archive/recover";
import { accessStatusLabel } from "@/lib/archaeology/classify";
import type { InvestigationView } from "@/lib/investigations/types";

export function WorkspaceView({ view }: { view: InvestigationView }) {
  const milestones = [
    { label: "Record opened", done: true },
    { label: "Search leads stored", done: view.sources.some((source) => source.discoveryMethod === "search"), detail: String(view.sources.filter((source) => source.discoveryMethod === "search").length) },
    { label: "Observations stored", done: view.observations.length > 0, detail: String(view.observations.length) },
    { label: "Findings recorded", done: view.findings.length > 0, detail: String(view.findings.length) },
    { label: "Archive captures", done: view.archives.length > 0, detail: String(view.archives.length) },
  ];

  const completionCount = milestones.filter((item) => item.done).length;

  return (
    <div className="case-workspace space-y-6">
      <CaseOpening investigationId={view.id} title={view.title} startingUrl={view.startingUrl} objective={view.objective} />
      {view.mode === "sample" ? <SampleBanner /> : null}
      <header className="case-hero min-w-0">
        <div className="case-hero-main">
          <p className="case-eyebrow"><span className="case-status-light" /> Case file <span>/</span> {view.status}</p>
          <h1 className="case-title">{view.title}</h1>
          <div className="case-objective"><span>THE QUESTION</span><p>{view.objective}</p></div>
        </div>
        <div className="case-hero-aside">
          <div className="case-file-stamp"><span>CASE RECORD</span><strong>{String(view.id).slice(0, 8).toUpperCase()}</strong><span>{view.status.toUpperCase()}</span></div>
          <Link href={`/investigations/${view.id}/browser`} className="case-browser-portal">
            <span className="case-portal-glyph" aria-hidden="true"><span /><span /><span /></span>
            <span><small>ENTER THE FIELD</small><strong>Open live browser</strong></span>
            <ArrowUpRight aria-hidden="true" className="case-portal-arrow" />
          </Link>
        </div>
        <div className="case-hero-grain" aria-hidden="true" />
      </header>
      <BeginInvestigationAudio investigationId={view.id} />
      <section className="case-operations" aria-labelledby="case-operations-title">
        <div className="case-section-title">
          <div><p className="case-eyebrow">Choose your next move</p><h2 id="case-operations-title">Work the case</h2></div>
          <span className="case-section-note">{completionCount} / {milestones.length} checkpoints complete</span>
        </div>
        <div className="case-operation-grid">
          <div className="case-operation case-operation-search"><span className="case-operation-index">01 <i>SEARCH THE WEB</i></span><DiscoveryPanel
            investigationId={view.id}
            disabled={view.mode === "sample"}
            leads={view.sources.filter((source) => source.discoveryMethod === "search")}
          /></div>
          <div className="case-operation case-operation-excavate"><span className="case-operation-index">02 <i>FOLLOW THE TRAIL</i></span><FieldworkPanel investigationId={view.id} disabled={view.mode === "sample"} /></div>
          <div className="case-operation case-operation-analyze"><span className="case-operation-index">03 <i>MAKE CONNECTIONS</i></span><AnalysisPanel investigationId={view.id} disabled={view.mode === "sample"} /></div>
        </div>
      </section>
      <EvidenceArrivalNotice
        counts={{
          sources: view.sources.length,
          observations: view.observations.length,
          findings: view.findings.length,
          archives: view.archives.length,
        }}
      />
      <section id="case-evidence-room" className="case-evidence-room" aria-labelledby="case-evidence-title">
        <div className="case-section-title">
          <div><p className="case-eyebrow">Collected traces</p><h2 id="case-evidence-title">Evidence room</h2></div>
          <div className="case-evidence-actions">
            <span className="case-section-note">Preserved records only</span>
            <Link href={`/investigations/${view.id}/graph`} className="case-map-link">Explore the evidence map <ArrowUpRight aria-hidden="true" className="size-3" /></Link>
          </div>
        </div>
        <div className="case-evidence-grid">
        <Panel title="Source ledger" eyebrow={`${view.sources.length} stored`}>
          {view.sources.length === 0 ? (
            <EmptyState title="No sources stored" detail="A source appears here after it is saved with this investigation." />
          ) : (
            <ul className="space-y-3">
              {view.sources.map((source) => (
                <li key={source.id} className="min-w-0 border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <p className="truncate text-sm text-foreground">{source.title ?? "Untitled source"}</p>
                  <p className="truncate text-xs text-muted">{source.url}</p>
                  <p className="mt-1 text-xs text-muted">
                    {source.discoveryMethod === "search"
                      ? "Search lead — not a confirmed finding"
                      : `${source.sourceType} · ${source.accessStatus}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Field log" eyebrow="Progress">
            <ol className="case-milestone-list">
              {milestones.map((item, index) => (
                <li key={item.label} className={item.done ? "is-complete" : ""}>
                  <span className="case-milestone-dot">{item.done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  <span className="case-milestone-label">{item.label}</span>
                  <span className="case-milestone-value">{item.detail ?? (item.done ? "Logged" : "Awaiting")}</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Activity" eyebrow="Feed">
              {view.activity.length === 0 ? (
                <EmptyState title="No activity" detail="Stored events from this investigation will be listed here." />
              ) : (
                <ol className="space-y-3">
                  {view.activity.map((item) => (
                    <li key={item.id}>
                      <p className="text-sm text-foreground">{item.label}</p>
                      <p className="text-xs text-muted">{item.at}</p>
                    </li>
                  ))}
                </ol>
              )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <ArtifactPanel
            investigationId={view.id}
            disabled={view.mode === "sample"}
            sources={view.sources.map((source) => ({ id: source.id, title: source.title, url: source.url }))}
          />
          <Panel title="Findings" eyebrow="Conclusions">
            {view.findings.length === 0 ? (
              <EmptyState
                title="No findings"
                detail="A finding is recorded only when it cites stored evidence. None are saved."
              />
            ) : (
              <ul className="space-y-4">
                {view.findings.map((finding) => (
                  <li key={finding.id}>
                    <p className="text-sm text-foreground">{finding.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{finding.explanation}</p>
                    <p className="mt-1 text-xs tracking-[0.12em] text-amber uppercase">{finding.classification}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Historical archive" eyebrow="Captures">
            <ArchiveLookup investigationId={view.id} disabled={view.mode === "sample"} />
            {view.archives.length === 0 ? (
              <EmptyState
                title="No captures stored"
                detail="A capture is listed here only after the Wayback lookup stores one. An empty list is not a claim that the page was never archived."
              />
            ) : (
              <ul className="space-y-4">
                {view.archives.map((archive) => {
                  const observation = view.observations.find((item) => item.sourceId === archive.sourceId);
                  const comparison = describeArchiveComparison({
                    observationAccessible: observation?.httpStatus != null && observation.httpStatus < 400,
                    observationWhen: observation?.observedAt ?? null,
                    observationTitle: observation?.pageTitle ?? null,
                    observationStatus: observation?.httpStatus ?? null,
                    captureAvailable: archive.availabilityStatus === "available",
                    capturedAt: archive.capturedAt,
                  });
                  return (
                    <li key={archive.id} className="min-w-0">
                      <p className="text-sm text-foreground">{archive.originalUrl}</p>
                      <p className="text-xs text-muted">
                        {archive.availabilityStatus === "available"
                          ? "Accessible archived copy"
                          : archive.availabilityStatus === "missing"
                            ? "No accessible snapshot"
                            : "Snapshot not verified"}
                        {" · "}
                        {archive.capturedAt}
                      </p>
                      {archive.availabilityStatus === "available" ? (
                        <a
                          href={archive.archiveUrl}
                          className="truncate text-xs text-amber underline-offset-2 hover:underline"
                        >
                          Open archived copy
                        </a>
                      ) : (
                        <p className="text-xs text-muted">This capture is not shown as recovered.</p>
                      )}
                      {comparison ? <p className="mt-1 text-xs leading-5 text-muted">{comparison}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Potentially missing references" eyebrow="Not deleted">
            {view.sources.filter((source) =>
              ["http_404", "http_403", "timeout", "navigation_error"].includes(source.accessStatus),
            ).length === 0 ? (
              <EmptyState
                title="No missing references recorded"
                detail="Pages that cannot be opened are listed here with their access result. They are not marked as deleted."
              />
            ) : (
              <ul className="space-y-3">
                {view.sources
                  .filter((source) =>
                    ["http_404", "http_403", "timeout", "navigation_error"].includes(source.accessStatus),
                  )
                  .map((source) => (
                    <li key={source.id} className="min-w-0">
                      <p className="truncate text-sm">{source.title ?? source.url}</p>
                      <p className="truncate text-xs text-muted">{source.url}</p>
                      <p className="text-xs text-amber">{accessStatusLabel(source.accessStatus)}. Not classified as deleted.</p>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
          <aside className="case-presence-note">
            <p className="case-eyebrow">Residual presence</p>
            <h2>The archive has a pulse.</h2>
            <p>Unpredictable atmosphere runs separately from the evidence work. Change its intensity or turn it off in Settings.</p>
            <Link href="/settings" className="case-presence-link">Tune the atmosphere <ArrowUpRight aria-hidden="true" className="size-3" /></Link>
          </aside>
        </div>
        </div>
      </section>
    </div>
  );
}
