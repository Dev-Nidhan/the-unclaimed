"use client";

import { useState } from "react";
import {
  dateKindLabel,
  formatRecordedDate,
  timelineCategories,
  timelineCategoryLabels,
  type TimelineCategory,
  type TimelineEvent,
} from "@/lib/investigations/graph";

function allOn(): Record<TimelineCategory, boolean> {
  return Object.fromEntries(timelineCategories.map((category) => [category, true])) as Record<
    TimelineCategory,
    boolean
  >;
}

export function EvidenceTimeline({ events }: { events: TimelineEvent[] }) {
  const [categories, setCategories] = useState(allOn);
  const visible = events.filter((event) => categories[event.category]);

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-4">
      <header>
        <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Chronology</p>
        <h2 className="font-serif text-lg">Historical timeline</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          A historical date is a capture timestamp stored from the archive. Every other date is when this investigation
          discovered, read, or recorded the record.
        </p>
      </header>
      <fieldset className="mt-4">
        <legend className="text-xs tracking-[0.14em] text-muted uppercase">Show</legend>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {timelineCategories.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={categories[category]}
                onChange={() => setCategories((current) => ({ ...current, [category]: !current[category] }))}
              />
              {timelineCategoryLabels[category]}
            </label>
          ))}
        </div>
      </fieldset>
      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No stored dates match this filter.</p>
      ) : (
        <ol className="mt-4 space-y-3 border-l border-line pl-4">
          {visible.map((event) => (
            <li key={event.id}>
              <p className="text-xs tracking-[0.12em] text-amber uppercase">
                {timelineCategoryLabels[event.category]} · {dateKindLabel(event.dateKind)}
              </p>
              <p className="font-serif text-base">{event.title}</p>
              <p className="text-sm text-foreground">{formatRecordedDate(event.at)}</p>
              <p className="text-sm leading-6 text-muted">{event.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
