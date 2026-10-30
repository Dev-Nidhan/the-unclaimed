"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/panel";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Monitoring</p>
      <h1 className="font-serif text-4xl">This view stopped</h1>
      <p className="text-sm leading-6 text-muted">
        The failure was recorded. The message on screen does not include keys, browser credentials, or stored page text.
      </p>
      {error.digest ? <p className="text-sm text-muted">Reference {error.digest}</p> : null}
      <button type="button" className={buttonClass()} onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
