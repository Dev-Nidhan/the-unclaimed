"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/panel";

export function ArchiveLookup({
  investigationId,
  disabled,
}: {
  investigationId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${investigationId}/archive`, { method: "POST" });
      const body = (await response.json()) as {
        error?: string;
        checked?: number;
        saved?: number;
        available?: number;
      };
      if (!response.ok) {
        setError(body.error ?? "Wayback lookup failed.");
        return;
      }
      setMessage(
        body.available
          ? `${body.available} accessible archived ${body.available === 1 ? "copy" : "copies"} stored from ${body.checked} sources.`
          : `No accessible archived copy was stored from ${body.checked ?? 0} sources.`,
      );
      router.refresh();
    } catch {
      setError("Wayback lookup failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-3 space-y-2">
      <button type="button" className={buttonClass("quiet")} disabled={disabled || pending} onClick={check}>
        {pending ? "Checking Wayback…" : "Check Wayback"}
      </button>
      {disabled ? <p className="text-xs text-muted">The sample layout does not query the Internet Archive.</p> : null}
      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
