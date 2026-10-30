import { z } from "zod";
import { requestStructured } from "./ollama";
import { findingJsonSchema, groundFinding, normalizeText, type CandidateFinding, type EvidencePacket } from "./ground";

const findingResponse = z.object({
  findings: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(180),
        explanation: z.string().trim().min(1).max(1200),
        classification: z.enum(["VERIFIED", "INFERRED", "UNRESOLVED"]),
        sourceId: z.uuid(),
        observationId: z.uuid(),
        quotation: z.string().max(400),
      }),
    )
    .max(3),
});

export const entityJsonSchema = {
  type: "object",
  properties: {
    entities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          entityType: { type: "string" },
          description: { type: "string" },
          sourceId: { type: "string" },
          observationId: { type: "string" },
        },
        required: ["name", "entityType", "description", "sourceId", "observationId"],
      },
    },
  },
  required: ["entities"],
} as const;

export const entityResponse = z.object({
  entities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        entityType: z.string().trim().min(1).max(60),
        description: z.string().trim().min(1).max(400),
        sourceId: z.uuid(),
        observationId: z.uuid(),
      }),
    )
    .max(5),
});

export const relationshipJsonSchema = {
  type: "object",
  properties: {
    relationships: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fromName: { type: "string" },
          toName: { type: "string" },
          relationshipType: { type: "string" },
          sourceId: { type: "string" },
          observationId: { type: "string" },
          classification: { type: "string", enum: ["VERIFIED", "INFERRED", "UNRESOLVED"] },
        },
        required: ["fromName", "toName", "relationshipType", "sourceId", "observationId", "classification"],
      },
    },
  },
  required: ["relationships"],
} as const;

export const relationshipResponse = z.object({
  relationships: z
    .array(
      z.object({
        fromName: z.string().trim().min(1).max(120),
        toName: z.string().trim().min(1).max(120),
        relationshipType: z.string().trim().min(1).max(80),
        sourceId: z.uuid(),
        observationId: z.uuid(),
        classification: z.enum(["VERIFIED", "INFERRED", "UNRESOLVED"]),
      }),
    )
    .max(4),
});

export function renderPacket(packet: EvidencePacket): string {
  const records = packet.records
    .map(
      (record) =>
        `sourceId: ${record.sourceId}\nobservationId: ${record.observationId}\nurl: ${record.url}\ntitle: ${record.title ?? ""}\nobservedAt: ${record.observedAt}\nhttpStatus: ${record.httpStatus ?? "unknown"}\ntext: ${record.text.slice(0, 1500)}`,
    )
    .join("\n\n");
  const archives = packet.archives
    .map(
      (archive) =>
        `sourceId: ${archive.sourceId}\narchiveUrl: ${archive.archiveUrl}\noriginalUrl: ${archive.originalUrl}\ncapturedAt: ${archive.capturedAt}\navailability: ${archive.availabilityStatus}`,
    )
    .join("\n\n");
  return [
    `Subject: ${packet.subject}`,
    `Objective: ${packet.objective}`,
    `Allowed years: ${packet.allowedYears.join(", ") || "none"}`,
    `Allowed URLs: ${packet.allowedUrls.join(", ") || "none"}`,
    "Stored observations:",
    records || "none",
    "Stored archive captures:",
    archives || "none",
  ].join("\n");
}

export async function findingsFor(
  instruction: string,
  packet: EvidencePacket,
): Promise<{ kept: CandidateFinding[]; discarded: number }> {
  const parsed = await requestStructured({
    instruction,
    packet: renderPacket(packet),
    schema: findingResponse,
    jsonSchema: findingJsonSchema as unknown as Record<string, unknown>,
  });
  const kept: CandidateFinding[] = [];
  let discarded = 0;
  for (const finding of parsed.findings) {
    const grounded = groundFinding(finding, packet);
    if (grounded) {
      kept.push(grounded);
    } else {
      discarded += 1;
    }
  }
  return { kept, discarded };
}

export function summarizePages(packet: EvidencePacket) {
  return findingsFor(
    "Summarize the stored page text. A summary is INFERRED unless it is only a short quotation from the text, in which case it may be VERIFIED and the quotation field must be copied from that text.",
    packet,
  );
}

export function extractDocumentReferences(packet: EvidencePacket) {
  return findingsFor(
    "List document or page references that are explicitly present in the stored text or allowed URLs. Do not add references that are not in the packet. Use UNRESOLVED if a reference is only hinted at.",
    packet,
  );
}

export function analyzeMissingReferences(packet: EvidencePacket) {
  return findingsFor(
    "Look only at stored access results. If a source was not opened, call it unresolved or missing as recorded. Never say a document was recovered or deleted unless the stored text says so.",
    packet,
  );
}

export function compareEvidence(packet: EvidencePacket) {
  return findingsFor(
    "Compare a stored current observation with a stored archive capture only when both are present. Do not reconstruct missing text. If either side is absent, return an UNRESOLVED finding or an empty findings list.",
    packet,
  );
}

export function generateTimeline(packet: EvidencePacket) {
  return findingsFor(
    "Build a timeline using only the allowed years and dates already present in observedAt, capturedAt, or the stored text. If no date is available, return an UNRESOLVED finding that says the date is not in the evidence.",
    packet,
  );
}

export function generateUnresolvedQuestions(packet: EvidencePacket) {
  return findingsFor(
    "Ask questions the stored evidence cannot answer. Every question must use classification UNRESOLVED and cite the observation that leaves it open.",
    packet,
  );
}

export async function extractEntities(packet: EvidencePacket) {
  const parsed = await requestStructured({
    instruction:
      "Extract named entities copied verbatim from the stored text. If a name is not in the text, omit it. Do not invent people, organizations, or places.",
    packet: renderPacket(packet),
    schema: entityResponse,
    jsonSchema: entityJsonSchema as unknown as Record<string, unknown>,
  });
  return parsed.entities.filter((entity) => {
    const record = packet.records.find(
      (item) => item.observationId === entity.observationId && item.sourceId === entity.sourceId,
    );
    return record ? entityNameIsSupported(entity.name, record.text) : false;
  });
}

export async function suggestRelationships(packet: EvidencePacket) {
  const parsed = await requestStructured({
    instruction:
      "Suggest relationships only between names that both appear in the same stored observation. If the connection is not explicit, use UNRESOLVED or omit it. Do not invent names.",
    packet: renderPacket(packet),
    schema: relationshipResponse,
    jsonSchema: relationshipJsonSchema as unknown as Record<string, unknown>,
  });
  return parsed.relationships.filter((link) => {
    const record = packet.records.find(
      (item) => item.observationId === link.observationId && item.sourceId === link.sourceId,
    );
    return (
      record != null &&
      link.fromName.trim().toLowerCase() !== link.toName.trim().toLowerCase() &&
      entityNameIsSupported(link.fromName, record.text) &&
      entityNameIsSupported(link.toName, record.text)
    );
  });
}

export function entityNameIsSupported(name: string, text: string): boolean {
  return normalizeText(text).includes(normalizeText(name));
}
