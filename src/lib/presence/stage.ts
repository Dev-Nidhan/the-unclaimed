import type { PresencePlan } from "./plans";
import type { PresenceMode } from "./events";

function toneGain(mode: PresenceMode): number {
  if (mode === "intense") {
    return 0.06;
  }
  if (mode === "subtle") {
    return 0.02;
  }
  return 0.035;
}

function playTone(durationMs: number, mode: PresenceMode): () => void {
  const Context = window.AudioContext;
  if (!Context) {
    return () => undefined;
  }
  let audio: AudioContext;
  try {
    audio = new Context();
  } catch {
    return () => undefined;
  }
  const oscillator = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = 174;
  filter.type = "lowpass";
  filter.frequency.value = 520;
  gain.gain.value = toneGain(mode);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  let stopped = false;
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    try {
      oscillator.stop();
      void audio.close();
    } catch {
      /* The tone already ended. */
    }
  };
  const timer = window.setTimeout(stop, durationMs);
  return () => {
    window.clearTimeout(timer);
    stop();
  };
}

function distortIcon(): () => void {
  const head = document.head;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const created = !link;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    head.append(link);
  }
  const previous = link.href;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#141311";
    context.fillRect(0, 0, 32, 32);
    context.strokeStyle = "#b08958";
    context.lineWidth = 2;
    context.strokeRect(5, 8, 16, 18);
    context.strokeRect(11, 4, 15, 16);
  }
  link.href = canvas.toDataURL("image/png");
  const marks = [...document.querySelectorAll<HTMLElement>("[data-presence-mark]")];
  for (const mark of marks) {
    mark.classList.add("presence-mark");
  }
  return () => {
    if (!link) {
      return;
    }
    if (created) {
      link.remove();
    } else {
      link.href = previous;
    }
    for (const mark of marks) {
      mark.classList.remove("presence-mark");
    }
  };
}

function grain(layer: HTMLElement, dense: boolean): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = dense ? "presence-static" : "presence-noise";
  canvas.width = 180;
  canvas.height = 120;
  layer.append(canvas);
  const context = canvas.getContext("2d");
  let frame = 0;
  const draw = () => {
    if (!context) {
      return;
    }
    const image = context.createImageData(canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const shade = Math.random() * (dense ? 255 : 90);
      image.data[index] = shade;
      image.data[index + 1] = shade;
      image.data[index + 2] = shade;
      image.data[index + 3] = dense ? 90 : 40;
    }
    context.putImageData(image, 0, 0);
    frame = window.requestAnimationFrame(draw);
  };
  frame = window.requestAnimationFrame(draw);
  return () => {
    window.cancelAnimationFrame(frame);
    canvas.remove();
  };
}

function secondaryCursor(layer: HTMLElement): () => void {
  const node = document.createElement("div");
  node.className = "presence-cursor";
  layer.append(node);
  const move = (event: PointerEvent) => {
    node.style.transform = `translate(${event.clientX + 18}px, ${event.clientY + 18}px)`;
  };
  document.addEventListener("pointermove", move);
  return () => {
    document.removeEventListener("pointermove", move);
    node.remove();
  };
}

function caption(layer: HTMLElement, text: string, large = false): () => void {
  const node = document.createElement("p");
  node.className = large ? "presence-cryptic" : "presence-caption";
  node.textContent = text;
  layer.append(node);
  return () => node.remove();
}

function card(layer: HTMLElement, title: string, path: string, size: "preview" | "tab" | "reflection"): () => void {
  const node = document.createElement("div");
  node.className = size === "tab" ? "presence-ghost presence-ghost-tab" : size === "preview" ? "presence-ghost" : "presence-reflection";
  const label = document.createElement("p");
  label.className = "presence-kicker";
  label.textContent = size === "reflection" ? "Reflection" : "In-app tab";
  const heading = document.createElement("p");
  heading.className = "presence-card-title";
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.className = "presence-card-path";
  detail.textContent = path;
  node.append(label, heading, detail);
  layer.append(node);
  return () => node.remove();
}

function anomaly(text: string): () => void {
  const nodes = [...document.querySelectorAll<HTMLElement>("[data-presence-text]")];
  const previous = nodes.map((node) => node.textContent);
  for (const node of nodes) {
    node.textContent = text;
  }
  return () => {
    nodes.forEach((node, index) => {
      node.textContent = previous[index] ?? "";
    });
  };
}

export function playPresencePlan(plan: PresencePlan, layer: HTMLElement | null, mode: PresenceMode): () => void {
  const cleanups: Array<() => void> = [];
  if (layer) {
    layer.dataset.event = plan.id;
    if (plan.flicker) {
      layer.classList.add("presence-flicker");
      cleanups.push(() => layer.classList.remove("presence-flicker"));
    }
    if (plan.noise) {
      cleanups.push(grain(layer, false));
    }
    if (plan.static) {
      cleanups.push(grain(layer, true));
    }
    if (plan.cursor) {
      cleanups.push(secondaryCursor(layer));
    }
    if (plan.caption) {
      cleanups.push(caption(layer, plan.caption, plan.id === "cryptic-message"));
    }
    if (plan.reflection) {
      cleanups.push(card(layer, plan.reflection.title, plan.reflection.path, "reflection"));
    }
    if (plan.ghost) {
      cleanups.push(card(layer, plan.ghost.title, plan.ghost.path, plan.ghost.size));
    }
  }
  if (plan.icon) {
    cleanups.push(distortIcon());
  }
  if (plan.text) {
    cleanups.push(anomaly(plan.text));
  }
  if (plan.transition) {
    const shell = document.querySelector(".atmosphere");
    shell?.classList.add("presence-transition");
    cleanups.push(() => shell?.classList.remove("presence-transition"));
  }
  if (plan.tone) {
    cleanups.push(playTone(Math.min(plan.durationMs, 800), mode));
  }
  return () => {
    if (layer) {
      delete layer.dataset.event;
    }
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
