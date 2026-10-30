"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#141311", color: "#e7e1d6", fontFamily: "Georgia, serif" }}>
        <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1.5rem" }}>
          <p style={{ letterSpacing: "0.16em", textTransform: "uppercase", color: "#b08958", fontSize: "0.75rem" }}>
            Monitoring
          </p>
          <h1 style={{ fontWeight: 500 }}>The page could not be shown</h1>
          <p style={{ lineHeight: 1.6 }}>
            The failure was recorded. Page text, keys, and conversation content are not attached.
          </p>
          {error.digest ? <p style={{ color: "#a39b90" }}>Reference {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
