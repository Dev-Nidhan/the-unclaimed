import { EmptyState, Panel, SampleBanner } from "@/components/ui/panel";
import type { InvestigationView } from "@/lib/investigations/types";

export function ArchiveReport({ view }: { view: InvestigationView }) {
  return (
    <article className="space-y-4">
      {view.mode === "sample" ? <SampleBanner /> : null}
      <header>
        <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Archive report</p>
        <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">{view.title}</h1>
      </header>
      <Panel title="Summary" eyebrow="Investigation">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Subject</dt>
            <dd className="mt-1 text-sm">{view.subject}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Status</dt>
            <dd className="mt-1 text-sm capitalize">{view.status}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Objective</dt>
            <dd className="mt-1 text-sm leading-6">{view.objective}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs tracking-[0.14em] text-muted uppercase">Starting address</dt>
            <dd className="mt-1 truncate font-mono text-xs text-muted">{view.startingUrl}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Historical timeline" eyebrow="Stored events">
        {view.activity.length === 0 ? (
          <EmptyState title="No timeline" detail="The timeline lists only events that were saved." />
        ) : (
          <ol className="space-y-4 border-l border-line pl-4">
            {view.activity.map((item) => (
              <li key={item.id}>
                <p className="text-sm text-foreground">{item.label}</p>
                <p className="text-xs text-muted">{item.at}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <Panel title="Findings" eyebrow="Conclusions">
        {view.findings.length === 0 ? (
          <EmptyState title="No findings" detail="Conclusions appear after they are tied to stored evidence." />
        ) : (
          <ul className="space-y-4">
            {view.findings.map((finding) => (
              <li key={finding.id}>
                <h3 className="font-serif text-xl">{finding.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{finding.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Source references" eyebrow="Stored sources">
        {view.sources.length === 0 ? (
          <EmptyState title="No references" detail="Sources saved for this investigation will be listed here." />
        ) : (
          <ul className="space-y-3">
            {view.sources.map((source) => (
              <li key={source.id}>
                <p className="text-sm">{source.title ?? "Untitled source"}</p>
                <a href={source.url} className="truncate text-xs text-amber underline-offset-2 hover:underline">
                  {source.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Unresolved questions" eyebrow="Open leads">
        {view.mode === "sample" ? (
          <p className="text-sm leading-6 text-muted">
            Sample question: this sentence is placeholder copy, not an unresolved lead.
          </p>
        ) : (
          <EmptyState
            title="None recorded"
            detail="Open questions are not stored yet, so this report does not invent them."
          />
        )}
      </Panel>
    </article>
  );
}
