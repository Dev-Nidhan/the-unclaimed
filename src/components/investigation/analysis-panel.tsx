"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/panel";
import type { AnalysisProgress } from "@/lib/ai/progress";

const idle: AnalysisProgress = {
  status: "idle",
  phase: "Not started",
  findingsSaved: 0,
  discarded: 0,
  errors: [],
};

export function AnalysisPanel({
  investigationId,
  disabled,
}: {
  investigationId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<AnalysisProgress>(idle);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled) {
      return;
    }
    let stop = false;
    async function poll() {
      try {
        const response = await fetch(`/api/investigations/${investigationId}/analysis`);
        if (!response.ok || stop) {
          return;
        }
        const body = (await response.json()) as AnalysisProgress;
        if (!stop) {
          setProgress(body);
          if (body.status === "completed") {
            router.refresh();
          }
        }
      } catch {
        if (!stop) {
          setError("Analysis progress could not be read.");
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

  async function start() {
    setError(null);
    const response = await fetch(`/api/investigations/${investigationId}/analysis`, { method: "POST" });
    const body = (await response.json()) as AnalysisProgress & { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Analysis could not start.");
      return;
    }
    setProgress(body);
  }

  const running = progress.status === "running";

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Local model</p>
          <h2 className="font-serif text-lg">AI activity</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {progress.phase}. Gemma reads only stored observations. Verified claims need a quotation from that text. Unsupported claims stay unresolved.
          </p>
        </div>
        <button type="button" className={buttonClass()} disabled={disabled || running} onClick={() => void start()}>
          {running ? "Reading evidence…" : "Analyze stored evidence"}
        </button>
      </div>
      {disabled ? <p className="mt-3 text-sm text-muted">The sample layout has no stored evidence to analyze.</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs tracking-[0.14em] text-muted uppercase">Findings saved</dt>
          <dd className="font-serif text-2xl">{progress.findingsSaved}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-muted uppercase">Discarded</dt>
          <dd className="font-serif text-2xl">{progress.discarded}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.14em] text-muted uppercase">Status</dt>
          <dd className="mt-2 text-sm capitalize">{progress.status}</dd>
        </div>
      </dl>
      {progress.errors.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {progress.errors.map((item) => (
            <li key={item} className="text-sm text-danger">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
