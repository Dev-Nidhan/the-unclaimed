"use client";

import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/ui/panel";
import { closeInvestigationAudio } from "@/lib/audio/session";
import type { BrowserView } from "@/lib/browser/types";

const emptyView: BrowserView = {
  status: "none",
  pageUrl: null,
  pageTitle: null,
  liveViewUrl: null,
};

export function CloudBrowser({
  investigationId,
  startingUrl,
  disabled,
  fill = false,
}: {
  investigationId: string;
  startingUrl: string;
  disabled: boolean;
  fill?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<BrowserView>(emptyView);
  const [address, setAddress] = useState(startingUrl);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data === "browserbase-disconnected") {
        setView(emptyView);
        setError("The live view disconnected.");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (disabled) {
      return;
    }
    let stop = false;
    async function load() {
      try {
        const response = await fetch(`/api/investigations/${investigationId}/browser`);
        const payload = (await response.json()) as BrowserView & { error?: string };
        if (stop || !response.ok) {
          return;
        }
        setView(payload);
        if (payload.pageUrl) {
          setAddress(payload.pageUrl);
        }
      } catch {
        if (!stop) {
          setError("The cloud browser could not be read.");
        }
      }
    }
    void load();
    return () => {
      stop = true;
    };
  }, [disabled, investigationId]);

  async function send(body: { action: string; url?: string }) {
    setPending(body.action);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${investigationId}/browser`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as BrowserView & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "The cloud browser request failed.");
        return;
      }
      setView(payload);
      if (payload.pageUrl) {
        setAddress(payload.pageUrl);
      }
      if (body.action === "complete") {
        router.refresh();
      }
    } catch {
      setError("The cloud browser request failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={fill ? "case-browser-console flex h-full min-h-0 flex-col gap-3" : "case-browser-console space-y-3"}>
      <div className="case-browser-windowbar">
        <span className="case-browser-window-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="case-browser-window-label">FIELD TERMINAL <i>/</i> LIVE VIEW IS NOT EVIDENCE</span>
        <span className={`case-browser-window-status ${view.status === "active" ? "is-live" : ""}`}>
          {view.status === "active" ? "SIGNAL LIVE" : "SIGNAL IDLE"}
        </span>
      </div>
      <div className="case-browser-toolbar flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-1">
          {[
            { action: "back", label: "Back", icon: ArrowLeft },
            { action: "forward", label: "Forward", icon: ArrowRight },
            { action: "reload", label: "Reload", icon: RefreshCw },
          ].map((control) => {
            const Icon = control.icon;
            return (
              <button
                key={control.action}
                type="button"
                disabled={disabled || pending !== null || view.status !== "active"}
                aria-disabled={disabled || view.status !== "active"}
                className="rounded-md border border-line p-2 text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => send({ action: control.action })}
              >
                <Icon aria-hidden="true" className="size-4" />
                <span className="sr-only">{control.label}</span>
              </button>
            );
          })}
        </div>
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send({ action: "navigate", url: address });
          }}
        >
          <label className="sr-only" htmlFor="address-bar">
            Address
          </label>
          <input
            id="address-bar"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            disabled={disabled || pending !== null}
            spellCheck={false}
            className={fieldClass()}
          />
          <button type="submit" className={buttonClass()} disabled={disabled || pending !== null}>
            {pending === "navigate" || pending === "start" ? "Opening…" : "Open"}
          </button>
        </form>
      </div>
      <div className="case-browser-actions flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass("quiet")}
          disabled={disabled || pending !== null || view.status === "active"}
          onClick={() => send({ action: "start" })}
        >
          {pending === "start" ? "Starting session…" : "Start session"}
        </button>
        <button
          type="button"
          className={buttonClass("quiet")}
          disabled={disabled || pending !== null || view.status !== "active"}
          onClick={() => send({ action: "stop" })}
        >
          Stop session
        </button>
        <button
          type="button"
          className={buttonClass("quiet")}
          disabled={disabled || pending !== null}
          onClick={() => {
            closeInvestigationAudio();
            void send({ action: "complete" });
          }}
        >
          Complete investigation
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {view.pageTitle ? <p className="case-browser-page-title text-sm text-muted">Last page: {view.pageTitle}</p> : null}
      <div className={`case-browser-screen ${fill ? "min-h-0 flex-1" : ""}`}>
        {disabled ? (
          <div className={`case-browser-empty flex items-center justify-center rounded-md border border-dashed border-line px-6 text-center ${fill ? "min-h-0 flex-1" : "min-h-56"}`}>
            <p className="max-w-md text-sm leading-6 text-muted">
              No browser session is open. The sample layout does not start a cloud browser.
            </p>
          </div>
        ) : view.liveViewUrl ? (
          <iframe
            title="Remote browser live view"
            src={view.liveViewUrl}
            sandbox="allow-same-origin allow-scripts"
            allow="clipboard-read; clipboard-write"
            className={`w-full rounded-md border border-line bg-raised ${fill ? "min-h-0 flex-1" : "h-[70vh]"}`}
          />
        ) : (
          <div className={`case-browser-empty flex items-center justify-center rounded-md border border-dashed border-line px-6 text-center ${fill ? "min-h-0 flex-1" : "min-h-56"}`}>
            <div className="case-browser-empty-copy">
              <span className="case-browser-radar" aria-hidden="true"><i /><i /><i /></span>
              <p className="font-serif text-xl text-foreground">Nothing is moving yet.</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                Start a temporary field session to open the investigation address. The live view is not stored as evidence.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
