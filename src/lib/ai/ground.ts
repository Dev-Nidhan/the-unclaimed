export type EvidenceRecord = {
  sourceId: string;
  observationId: string;
  url: string;
  title: string | null;
  text: string;
  observedAt: string;
  httpStatus: number | null;
};

export type ArchiveRecord = {
  sourceId: string;
  archiveUrl: string;
  originalUrl: string;
  capturedAt: string;
  availabilityStatus: string;
};

export type EvidencePacket = {
  investigationId: string;
  subject: string;
  objective: string;
  records: EvidenceRecord[];
  archives: ArchiveRecord[];
  allowedUrls: string[];
  allowedYears: string[];
};

export type CandidateFinding = {
  title: string;
  explanation: string;
  classification: "VERIFIED" | "INFERRED" | "UNRESOLVED";
  sourceId: string;
  observationId: string;
  quotation: string;
};

const findingJsonSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          classification: { type: "string", enum: ["VERIFIED", "INFERRED", "UNRESOLVED"] },
          sourceId: { type: "string" },
          observationId: { type: "string" },
          quotation: { type: "string" },
        },
        required: ["title", "explanation", "classification", "sourceId", "observationId", "quotation"],
      },
    },
  },
  required: ["findings"],
} as const;

export { findingJsonSchema };

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function yearsIn(value: string): string[] {
  return value.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/g) ?? [];
}

function urlsIn(value: string): string[] {
  return (value.match(/https?:\/\/[^\s)"']+/g) ?? []).map((url) => url.replace(/[.,]$/, ""));
}

export function groundFinding(candidate: CandidateFinding, packet: EvidencePacket): CandidateFinding | null {
  const record = packet.records.find(
    (item) => item.observationId === candidate.observationId && item.sourceId === candidate.sourceId,
  );
  if (!record) {
    return null;
  }

  const allowedYears = new Set([...packet.allowedYears, ...yearsIn(record.text)]);
  if (yearsIn(`${candidate.explanation} ${candidate.quotation}`).some((year) => !allowedYears.has(year))) {
    return null;
  }

  const allowedUrls = new Set(packet.allowedUrls);
  if (urlsIn(`${candidate.explanation} ${candidate.quotation}`).some((url) => !allowedUrls.has(url))) {
    return null;
  }

  const quotation = candidate.quotation.trim();
  const quotationMatches = quotation.length > 0 && normalizeText(record.text).includes(normalizeText(quotation));
  if (quotation && !quotationMatches) {
    return null;
  }
  if (candidate.classification === "VERIFIED" && !quotationMatches) {
    return null;
  }
  return candidate;
}
