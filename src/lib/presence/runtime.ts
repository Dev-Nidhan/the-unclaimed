import { presenceEventIds, presenceIntensity, type PresenceEventId, type PresenceMode } from "./events";
import { planPresenceEvent, type VisitedPage } from "./plans";
import {
  choosePresenceEvent,
  createPresenceClock,
  presenceSessionStage,
  sessionPresenceWeights,
  tickPresence,
  type PresenceClock,
  type PresenceTiming,
} from "./schedule";
import { playPresencePlan } from "./stage";
import { playInvestigationAudio, syncInvestigationAudio } from "../audio/session";

export type PresenceSnapshot = {
  pathname: string;
  mode: PresenceMode;
  reducedMotion: boolean;
  audioEnabled: boolean;
  timing: PresenceTiming;
};

export type PresenceDebug = {
  activeMs: number;
  targetMs: number;
  recent: PresenceEventId[];
  pauses: string[];
  investigationId: string | null;
  lastEvent: PresenceEventId | null;
  enabled: boolean;
};

const investigationPattern =
  /^\/investigations\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(?:browser|graph|report))?$/i;

const listeners = new Set<() => void>();

let reader: (() => PresenceSnapshot) | null = null;
let loop: number | null = null;
let clock: PresenceClock | null = null;
let investigationId: string | null = null;
let lastPath = "";
let lastTick = 0;
let layer: HTMLElement | null = null;
let cancelEffect: (() => void) | null = null;
let effectTimer: number | null = null;
let navigationTimer: number | null = null;
let submitTimer: number | null = null;
const pauses = new Set<string>();
let visits: VisitedPage[] = [];
let debug: PresenceDebug = {
  activeMs: 0,
  targetMs: 0,
  recent: [],
  pauses: [],
  investigationId: null,
  lastEvent: null,
  enabled: false,
};

function investigationFrom(pathname: string): string | null {
  return pathname.match(investigationPattern)?.[1] ?? null;
}

function emit() {
  debug = {
    activeMs: clock?.activeMs ?? 0,
    targetMs: clock?.targetMs ?? 0,
    recent: clock?.recent ?? [],
    pauses: [...pauses],
    investigationId,
    lastEvent: debug.lastEvent,
    enabled: reader ? reader().mode !== "disabled" : false,
  };
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePresence(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function presenceDebug(): PresenceDebug {
  return debug;
}

export function attachPresenceLayer(node: HTMLElement | null) {
  layer = node;
}

function stopEffect() {
  if (effectTimer != null) {
    window.clearTimeout(effectTimer);
    effectTimer = null;
  }
  cancelEffect?.();
  cancelEffect = null;
}

function context(snapshot: PresenceSnapshot, mode: PresenceMode) {
  return {
    mode,
    reducedMotion: snapshot.reducedMotion,
    audioEnabled: snapshot.audioEnabled,
    trail: visits,
    salt: Math.floor(clock?.activeMs ?? visits.length),
  };
}

function play(id: PresenceEventId, snapshot: PresenceSnapshot, mode: PresenceMode): boolean {
  const plan = planPresenceEvent(id, context(snapshot, mode));
  if (!plan) {
    return false;
  }
  stopEffect();
  cancelEffect = playPresencePlan(plan, layer, mode);
  effectTimer = window.setTimeout(() => stopEffect(), plan.durationMs);
  debug = { ...debug, lastEvent: id };
  return true;
}

function record(id: PresenceEventId, mode: Exclude<PresenceMode, "disabled">) {
  if (!investigationId) {
    return;
  }
  void fetch(`/api/investigations/${investigationId}/presence`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventType: id, intensity: presenceIntensity(mode) }),
    keepalive: true,
  }).catch(() => undefined);
}

function remember(path: string) {
  if (!path) {
    return;
  }
  const title = document.title || path;
  const last = visits[visits.length - 1];
  if (last?.path === path) {
    return;
  }
  visits = [...visits, { path, title }].slice(-12);
}

function isField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function bindPauses(): () => void {
  const onVisibility = () => {
    if (document.hidden) {
      pauses.add("hidden");
    } else {
      pauses.delete("hidden");
    }
    emit();
  };
  const onFocusIn = (event: FocusEvent) => {
    if (isField(event.target)) {
      pauses.add("typing");
      emit();
    }
  };
  const onFocusOut = (event: FocusEvent) => {
    if (isField(event.target)) {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (!isField(active)) {
          pauses.delete("typing");
          emit();
        }
      }, 0);
    }
  };
  const onSubmit = () => {
    if (submitTimer != null) {
      window.clearTimeout(submitTimer);
    }
    pauses.add("submitting");
    submitTimer = window.setTimeout(() => {
      pauses.delete("submitting");
      submitTimer = null;
      emit();
    }, 2000);
    emit();
  };
  const onPreview = (event: Event) => {
    const id = (event as CustomEvent<PresenceEventId>).detail;
    const snapshot = reader?.();
    if (!snapshot || !presenceEventIds.includes(id)) {
      return;
    }
    const mode = snapshot.mode === "disabled" ? "normal" : snapshot.mode;
    const trail =
      visits.length >= 2
        ? visits
        : [
            { path: "/", title: "Dashboard" },
            { path: snapshot.pathname || "/", title: document.title || "The Unclaimed" },
          ];
    const plan = planPresenceEvent(id, {
      mode,
      reducedMotion: snapshot.reducedMotion,
      audioEnabled: snapshot.audioEnabled,
      trail,
      salt: Date.now(),
    });
    if (!plan) {
      return;
    }
    stopEffect();
    cancelEffect = playPresencePlan(plan, layer, mode);
    effectTimer = window.setTimeout(() => stopEffect(), plan.durationMs);
    playInvestigationAudio(id);
    debug = { ...debug, lastEvent: id };
    emit();
  };
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("submit", onSubmit, true);
  window.addEventListener("the-unclaimed-presence-preview", onPreview);
  onVisibility();
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("submit", onSubmit, true);
    window.removeEventListener("the-unclaimed-presence-preview", onPreview);
    if (navigationTimer != null) {
      window.clearTimeout(navigationTimer);
      navigationTimer = null;
    }
    if (submitTimer != null) {
      window.clearTimeout(submitTimer);
      submitTimer = null;
    }
  };
}

function onFrame() {
  const snapshot = reader?.();
  if (!snapshot) {
    return;
  }
  const id = investigationFrom(snapshot.pathname);
  syncInvestigationAudio(snapshot.pathname);
  const enabled = snapshot.mode !== "disabled";
  if (enabled) {
    pauses.delete("disabled");
  } else if (!pauses.has("disabled")) {
    pauses.add("disabled");
    stopEffect();
  } else {
    pauses.add("disabled");
  }
  if (id) {
    pauses.delete("away");
  } else {
    pauses.add("away");
  }
  if (snapshot.pathname !== lastPath) {
    if (lastPath) {
      if (navigationTimer != null) {
        window.clearTimeout(navigationTimer);
      }
      pauses.add("navigating");
      navigationTimer = window.setTimeout(() => {
        pauses.delete("navigating");
        navigationTimer = null;
        emit();
      }, 1200);
    }
    remember(snapshot.pathname);
    lastPath = snapshot.pathname;
  }
  if (id !== investigationId) {
    visits = [];
    investigationId = id;
    clock = id && enabled ? createPresenceClock(snapshot.timing, Math.random) : null;
    if (id) {
      remember(snapshot.pathname);
    }
  } else if (enabled && id && !clock) {
    clock = createPresenceClock(snapshot.timing, Math.random);
  }
  if (document.querySelector("[data-presence-pause]")) {
    pauses.add("opening");
  } else {
    pauses.delete("opening");
  }
  const stage = id && enabled && clock ? presenceSessionStage(clock.activeMs) : "quiet";
  if (document.documentElement.dataset.presenceStage !== stage) {
    document.documentElement.dataset.presenceStage = stage;
  }
  const now = performance.now();
  const delta = Math.min(1000, Math.max(0, now - lastTick));
  lastTick = now;
  if (clock && enabled && id && pauses.size === 0) {
    const weights = sessionPresenceWeights(
      clock.activeMs + delta,
      snapshot.timing.weights,
      snapshot.mode === "disabled" ? "normal" : snapshot.mode,
    );
    const next = tickPresence(
      clock,
      delta,
      snapshot.timing,
      Math.random,
      false,
      weights,
    );
    let event = next.event;
    if (event) {
      let plan = planPresenceEvent(event, context(snapshot, snapshot.mode));
      let blocked = [...clock.recent];
      for (let attempt = 0; attempt < 6 && event && !plan; attempt += 1) {
        blocked = [...blocked, event].slice(-8);
        event = choosePresenceEvent(blocked, Math.random, weights);
        plan = planPresenceEvent(event, context(snapshot, snapshot.mode));
      }
      clock = {
        ...next.clock,
        recent: event && plan ? [...clock.recent, event].slice(-3) : clock.recent,
      };
      if (event && plan && snapshot.mode !== "disabled" && play(event, snapshot, snapshot.mode)) {
        playInvestigationAudio(event);
        record(event, snapshot.mode);
      }
    } else {
      clock = next.clock;
    }
  }
  emit();
}

export function startPresenceLoop(read: () => PresenceSnapshot): () => void {
  if (loop != null) {
    const previous = reader;
    reader = read;
    return () => {
      if (reader === read) {
        reader = previous;
      }
    };
  }
  reader = read;
  lastTick = performance.now();
  const stopPauses = bindPauses();
  loop = window.setInterval(onFrame, 500);
  emit();
  return () => {
    if (reader !== read) {
      return;
    }
    if (loop != null) {
      window.clearInterval(loop);
      loop = null;
    }
    reader = null;
    stopPauses();
    stopEffect();
    pauses.clear();
    clock = null;
    investigationId = null;
    lastPath = "";
    document.documentElement.dataset.presenceStage = "quiet";
    emit();
  };
}

export function requestPresencePreview(id: PresenceEventId) {
  window.dispatchEvent(new CustomEvent("the-unclaimed-presence-preview", { detail: id }));
}
