"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, X } from "lucide-react";
import { buttonClass } from "@/components/ui/panel";

const openingKeyPrefix = "the-unclaimed-case-opened:";

export function CaseOpening({
  investigationId,
  title,
  startingUrl,
  objective,
}: {
  investigationId: string;
  title: string;
  startingUrl: string;
  objective: string;
}) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<0 | 1>(0);
  const [origin, setOrigin] = useState(startingUrl);
  const enterRef = useRef<HTMLButtonElement>(null);
  const key = `${openingKeyPrefix}${investigationId}`;

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // The user can still enter even when this browser cannot remember it.
    }
    setOpen(false);
  }, [key]);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(key)) {
        setOpen(false);
        return;
      }
    } catch {
      // Keep the opening available when browser storage is blocked.
    }
    try {
      setOrigin(new URL(startingUrl).host || startingUrl);
    } catch {
      setOrigin(startingUrl);
    }
  }, [key, startingUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    enterRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
        return;
      }
      if (event.key === "Tab") {
        const targets = [...document.querySelectorAll<HTMLElement>(
          ".case-opening button:not(:disabled), .case-opening a[href], .case-opening [tabindex]:not([tabindex='-1'])",
        )];
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === document.querySelector(".case-opening"))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss, open, step]);

  if (!open) {
    return null;
  }

  return (
    <div className="case-opening-backdrop" data-presence-pause>
      <section className="case-opening" role="dialog" aria-modal="true" aria-labelledby="case-opening-title">
        <button type="button" className="case-opening-close" onClick={dismiss} aria-label="Skip opening">
          <X aria-hidden="true" className="size-4" />
        </button>
        <div className="case-opening-mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="case-eyebrow">Field note <span>/</span> {String(investigationId).slice(0, 8).toUpperCase()}</p>
        {step === 0 ? (
          <>
            <h2 id="case-opening-title">Somewhere,<br /><em>a trace remains.</em></h2>
            <p className="case-opening-copy">Before you enter, remember: the search follows evidence. The presence follows its own rhythm. One may uncover a clue; the other never proves one.</p>
            <div className="case-opening-name"><span>CASE FILE</span><strong>{title}</strong></div>
            <div className="case-opening-target"><span>FIRST ADDRESS</span><strong>{origin}</strong></div>
            <div className="case-opening-actions">
              <button ref={enterRef} type="button" className={buttonClass()} onClick={() => setStep(1)}>
                Read the field note <ArrowDown aria-hidden="true" className="size-4" />
              </button>
              <button type="button" className="case-opening-skip" onClick={dismiss}>Skip opening</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="case-opening-title">Keep the record<br /><em>and the unease apart.</em></h2>
            <p className="case-opening-copy">Every finding must point to stored evidence. Unusual moments belong to the atmosphere, not the case file. You can change or disable them in Settings.</p>
            <div className="case-opening-target"><span>YOUR QUESTION</span><strong>{objective}</strong></div>
            <div className="case-opening-actions">
              <button ref={enterRef} type="button" className={buttonClass()} onClick={dismiss}>
                Enter the case <ArrowUpRight aria-hidden="true" className="size-4" />
              </button>
              <button type="button" className="case-opening-skip" onClick={dismiss}>Skip opening</button>
            </div>
          </>
        )}
        <div className="case-opening-footer"><span>THE UNCLAIMED</span><span>{step + 1} / 2</span></div>
      </section>
    </div>
  );
}

type EvidenceCounts = {
  sources: number;
  observations: number;
  findings: number;
  archives: number;
};

export function EvidenceArrivalNotice({ counts }: { counts: EvidenceCounts }) {
  const previous = useRef(counts);
  const [arrived, setArrived] = useState<EvidenceCounts | null>(null);

  useEffect(() => {
    const next = {
      sources: Math.max(0, counts.sources - previous.current.sources),
      observations: Math.max(0, counts.observations - previous.current.observations),
      findings: Math.max(0, counts.findings - previous.current.findings),
      archives: Math.max(0, counts.archives - previous.current.archives),
    };
    previous.current = counts;
    if (Object.values(next).some((count) => count > 0)) {
      setArrived(next);
    }
  }, [counts]);

  if (!arrived) {
    return null;
  }

  const parts = [
    [arrived.sources, "source"],
    [arrived.observations, "observation"],
    [arrived.findings, "finding"],
    [arrived.archives, "archive capture"],
  ] as const;
  const summary = parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`)
    .join(" · ");

  return (
    <div className="case-arrival-notice" role="status" aria-live="polite">
      <span className="case-arrival-signal" aria-hidden="true" />
      <div><p className="case-eyebrow">New trace returned</p><p className="case-arrival-summary">{summary}</p></div>
      <button
        type="button"
        className="case-arrival-link"
        onClick={() => {
          const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
          document.getElementById("case-evidence-room")?.scrollIntoView({ behavior, block: "start" });
        }}
      >
        Reveal evidence <ArrowDown aria-hidden="true" className="size-3" />
      </button>
      <button type="button" className="case-arrival-dismiss" aria-label="Dismiss new evidence notice" onClick={() => setArrived(null)}>
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
