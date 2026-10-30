"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/panel";
import { accessStatusLabel } from "@/lib/archaeology/classify";
import type { FieldworkProgress } from "@/lib/archaeology/progress";

const idle: FieldworkProgress = {
  status: "idle",
  phase: "Not started",
  pagesVisited: 0,
  maxPages: 15,
  currentUrl: null,
  observationsSaved: 0,
  sourcesDiscovered: 0,
  errors: [],
  missingReferences: [],
};

export function FieldworkPanel({
  investigationId,
  disabled,
}: {
  investigationId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<FieldworkProgress>(idle);
  const [error, setError] = useState<string | null>(null);
  const previousStatus = useRef<FieldworkProgress["status"]>(idle.status);

  useEffect(() => {
    if (disabled) {
      return;
    }
    let stop = false;
    async function poll() {
      try {
        const response = await fetch(`/api/investigations/${investigationId}/archaeology`);
        if (!response.ok || stop) {
          return;
        }
        const next = (await response.json()) as FieldworkProgress;
        const wasRunning = previousStatus.current === "running" || previousStatus.current === "cancelling";
        const isRunning = next.status === "running" || next.status === "cancelling";
        previousStatus.current = next.status;
        setProgress(next);
        if (wasRunning && !isRunning) {
          router.refresh();
        }
      } catch {
        if (!stop) {
          setError("Progress could not be read.");
        }
      }
    }
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [disabled, investigationId, router]);

  async function send(action: "start" | "cancel") {
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${investigationId}/archaeology`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as FieldworkProgress & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Fieldwork could not be updated.");
        return;
      }
      previousStatus.current = body.status;
      setProgress(body);
    } catch {
      setError("Fieldwork could not be updated.");
    }
  }

  const running = progress.status === "running" || progress.status === "cancelling";

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Fieldwork</p>
          <h2 className="font-serif text-lg">Investigation progress</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {progress.phase}. Search leads are visited in a cloud browser. Inaccessible pages are not marked as deleted.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={buttonClass()} disabled={disabled || running} onClick={() => send("start")}>
            {running ? "Working…" : "Begin fieldwork"}
          </button>
          <button type="button" className={buttonClass("quiet")} disabled={disabled || !running} onClick={() => send("cancel")}>
            Cancel
          </button>
        </div>
      </div>
      {disabled ? <p className="mt-3 text-sm text-muted">Fieldwork is not run for the sample layout.</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs tracking-[0.14em] text-muted uppercase">Pages visited</dt>
          <dd className="font-serif text-2xl">
            {progress.pagesVisited}/{progress.maxPages}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-muted uppercase">Observations</dt>
          <dd className="font-serif text-2xl">{progress.observationsSaved}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-muted uppercase">New leads</dt>
          <dd className="font-serif text-2xl">{progress.sourcesDiscovered}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-muted uppercase">Status</dt>
          <dd className="mt-2 text-sm capitalize">{progress.status}</dd>
        </div>
      </dl>
      {progress.currentUrl ? <p className="mt-3 truncate text-xs text-muted">Current page: {progress.currentUrl}</p> : null}
      {progress.errors.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {progress.errors.map((item) => (
            <li key={item} className="text-sm text-danger">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {progress.missingReferences.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm text-foreground">Potentially missing references</h3>
          <ul className="mt-2 space-y-2">
            {progress.missingReferences.map((item) => (
              <li key={`${item.accessStatus}-${item.url}`} className="min-w-0">
                <p className="truncate text-sm">{item.url}</p>
                <p className="text-xs text-muted">
                  {accessStatusLabel(item.accessStatus)}. {item.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
