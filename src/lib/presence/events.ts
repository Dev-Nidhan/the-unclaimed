export const presenceEventIds = [
  "screen-flicker",
  "favicon-distortion",
  "secondary-cursor",
  "visual-noise",
  "page-reflection",
  "ghost-tab-preview",
  "radio-static",
  "text-anomaly",
  "cryptic-message",
  "ghost-tab",
  "voice",
  "interface-transition",
] as const;

export type PresenceEventId = (typeof presenceEventIds)[number];
export type PresenceTier = "common" | "uncommon" | "rare";
export type PresenceMode = "disabled" | "subtle" | "normal" | "intense";

export type PresenceEventDefinition = {
  id: PresenceEventId;
  tier: PresenceTier;
  label: string;
};

export const presenceEvents: readonly PresenceEventDefinition[] = [
  { id: "screen-flicker", tier: "common", label: "Brief screen flicker" },
  { id: "favicon-distortion", tier: "common", label: "Favicon distortion" },
  { id: "secondary-cursor", tier: "common", label: "Temporary secondary cursor" },
  { id: "visual-noise", tier: "common", label: "Subtle visual noise" },
  { id: "page-reflection", tier: "uncommon", label: "Page reflection" },
  { id: "ghost-tab-preview", tier: "uncommon", label: "Ghost tab preview" },
  { id: "radio-static", tier: "uncommon", label: "Radio-static visual" },
  { id: "text-anomaly", tier: "uncommon", label: "Interface text anomaly" },
  { id: "cryptic-message", tier: "rare", label: "Cryptic message" },
  { id: "ghost-tab", tier: "rare", label: "Ghost tab" },
  { id: "voice", tier: "rare", label: "Voice" },
  { id: "interface-transition", tier: "rare", label: "Interface transition" },
];

export const presenceWeights = { common: 65, uncommon: 25, rare: 10 } as const;

export function presenceIntensity(mode: Exclude<PresenceMode, "disabled">): number {
  if (mode === "subtle") {
    return 28;
  }
  if (mode === "intense") {
    return 84;
  }
  return 56;
}

export function presenceEventDefinition(id: PresenceEventId): PresenceEventDefinition {
  const found = presenceEvents.find((event) => event.id === id);
  if (!found) {
    throw new Error("Unknown presence event.");
  }
  return found;
}
