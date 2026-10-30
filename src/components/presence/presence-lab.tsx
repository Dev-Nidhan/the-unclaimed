"use client";

import { useState, useSyncExternalStore } from "react";
import { presenceEvents, type PresenceEventId } from "@/lib/presence/events";
import { requestPresencePreview, presenceDebug, subscribePresence } from "@/lib/presence/runtime";
import { defaultPresenceTiming, simulatePresence, type PresenceTiming } from "@/lib/presence/schedule";
import { buttonClass } from "@/components/ui/panel";

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function PresenceLab({ timing = defaultPresenceTiming }: { timing?: PresenceTiming }) {
  const debug = useSyncExternalStore(subscribePresence, presenceDebug, presenceDebug);
  const [log, setLog] = useState<string>("The simulation has not been run.");

  function simulate() {
    const events = simulatePresence(timing, mulberry32(Date.now() % 100000), 60 * 60 * 1000);
    const lines = events.map((event) => {
      const minute = Math.floor(event.atMs / 60000);
      const second = Math.floor((event.atMs % 60000) / 1000);
      return `${minute}m ${second}s ${event.id}`;
    });
    setLog(lines.join("\n") || "No event fired in the simulated hour.");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        These controls stay in development. A manual event plays inside this page and is not written to the database.
        The scheduler records an event only while a stored investigation is open.
      </p>
      <p className="text-sm text-muted">
        Scheduler {debug.enabled ? "armed" : "idle"}
        {debug.investigationId ? ` for this investigation` : ""}. Active {Math.round(debug.activeMs / 1000)}s. Next{" "}
        {Math.round(debug.targetMs / 1000)}s.
        {debug.pauses.length > 0 ? ` Paused: ${debug.pauses.join(", ")}.` : ""}
        {debug.lastEvent ? ` Last event: ${debug.lastEvent}.` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {presenceEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            className={buttonClass("quiet")}
            onClick={() => requestPresencePreview(event.id as PresenceEventId)}
          >
            {event.label}
          </button>
        ))}
      </div>
      <button type="button" className={buttonClass()} onClick={simulate}>
        Simulate one hour
      </button>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-raised px-3 py-2 text-xs leading-5 text-muted">
        {log}
      </pre>
    </div>
  );
}
