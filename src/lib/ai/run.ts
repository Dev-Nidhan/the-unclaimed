import {
  createEvidenceRelationship,
  createFindingWithEvidenceSet,
  findOrCreateEntity,
  getStoredInvestigation,
} from "../db/queries";
import type { EvidencePacket, EvidenceRecord } from "./ground";
import { analysisProgress, finishAnalysis, startAnalysis, updateAnalysis } from "./progress";
import { reportOperationFailure, traceOperation } from "../sentry/report";
import { scrubText } from "../sentry/scrub";
import {
  analyzeMissingReferences,
  compareEvidence,
  extractDocumentReferences,
  extractEntities,
  generateTimeline,
  generateUnresolvedQuestions,
  suggestRelationships,
  summarizePages,
} from "./tasks";

function yearsFrom(value: string): string[] {
  return value.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/g) ?? [];
}

export async function loadEvidencePacket(investigationId: string): Promise<EvidencePacket | null> {
  const stored = await getStoredInvestigation(investigationId);
  if (!stored || stored.observations.length === 0) {
    return null;
  }
  const sourceUrls = new Map(stored.sources.map((source) => [source.id, source.url]));
  const records: EvidenceRecord[] = stored.observations.map((observation) => ({
    sourceId: observation.sourceId,
    observationId: observation.id,
    url: sourceUrls.get(observation.sourceId) ?? "",
    title: observation.pageTitle,
    text: observation.extractedContent,
    observedAt: observation.observedAt.toISOString(),
    httpStatus: observation.httpStatus,
  }));
  const archives = stored.archives.map((archive) => ({
    sourceId: archive.sourceId,
    archiveUrl: archive.archiveUrl,
    originalUrl: archive.originalUrl,
    capturedAt: archive.capturedAt.toISOString(),
    availabilityStatus: archive.availabilityStatus,
  }));
  const allowedUrls = [
    ...stored.sources.flatMap((source) => [source.url, source.canonicalUrl]),
    ...archives.flatMap((archive) => [archive.archiveUrl, archive.originalUrl]),
  ];
  const allowedYears = [
    ...records.flatMap((record) => [record.observedAt.slice(0, 4), ...yearsFrom(record.text)]),
    ...archives.flatMap((archive) => [archive.capturedAt.slice(0, 4)]),
  ];
  return {
    investigationId,
    subject: stored.investigation.subject,
    objective: stored.investigation.objective,
    records,
    archives,
    allowedUrls,
    allowedYears,
  };
}

async function storeFindings(packet: EvidencePacket, findings: Awaited<ReturnType<typeof summarizePages>>) {
  let saved = 0;
  for (const finding of findings.kept) {
    await createFindingWithEvidenceSet({
      investigationId: packet.investigationId,
      title: finding.title,
      explanation: finding.explanation,
      classification: finding.classification,
      evidence: [{ sourceId: finding.sourceId, observationId: finding.observationId }],
    });
    saved += 1;
  }
  return { saved, discarded: findings.discarded };
}

export function runAnalysis(investigationId: string): Promise<void> {
  return traceOperation(
    { name: "Analyze stored evidence", operation: "ollama", investigationId },
    () => executeAnalysis(investigationId),
  );
}

async function executeAnalysis(investigationId: string): Promise<void> {
  startAnalysis(investigationId);
  try {
    const packet = await loadEvidencePacket(investigationId);
    if (!packet) {
      updateAnalysis(investigationId, {
        errors: ["No stored observations are available to analyze."],
      });
      finishAnalysis(investigationId, "failed", "Nothing stored to analyze");
      return;
    }

    const steps: Array<{ phase: string; run: () => Promise<{ saved: number; discarded: number }> }> = [
      { phase: "Summarizing stored pages", run: async () => storeFindings(packet, await summarizePages(packet)) },
      {
        phase: "Extracting entities",
        run: async () => {
          const entities = await extractEntities(packet);
          let saved = 0;
          for (const entity of entities) {
            await findOrCreateEntity({
              investigationId: packet.investigationId,
              name: entity.name,
              entityType: entity.entityType,
              description: entity.description,
            });
            saved += 1;
          }
          return { saved, discarded: 0 };
        },
      },
      { phase: "Extracting document references", run: async () => storeFindings(packet, await extractDocumentReferences(packet)) },
      { phase: "Reviewing missing references", run: async () => storeFindings(packet, await analyzeMissingReferences(packet)) },
      { phase: "Comparing evidence", run: async () => storeFindings(packet, await compareEvidence(packet)) },
      { phase: "Building a timeline from stored dates", run: async () => storeFindings(packet, await generateTimeline(packet)) },
      {
        phase: "Suggesting relationships",
        run: async () => {
          const links = await suggestRelationships(packet);
          let saved = 0;
          for (const link of links) {
            const fromEntity = await findOrCreateEntity({
              investigationId: packet.investigationId,
              name: link.fromName,
              entityType: "mentioned",
              description: "Named in a stored observation.",
            });
            const toEntity = await findOrCreateEntity({
              investigationId: packet.investigationId,
              name: link.toName,
              entityType: "mentioned",
              description: "Named in a stored observation.",
            });
            await createEvidenceRelationship({
              investigationId: packet.investigationId,
              fromEntityId: fromEntity.id,
              toEntityId: toEntity.id,
              relationshipType: link.relationshipType,
              evidenceSourceId: link.sourceId,
            });
            await createFindingWithEvidenceSet({
              investigationId: packet.investigationId,
              title: `${link.fromName} and ${link.toName}`,
              explanation: `Suggested relationship: ${link.relationshipType}. This uses only names present in the stored observation.`,
              classification: link.classification === "UNRESOLVED" ? "UNRESOLVED" : "INFERRED",
              evidence: [{ sourceId: link.sourceId, observationId: link.observationId }],
            });
            saved += 1;
          }
          return { saved, discarded: 0 };
        },
      },
      { phase: "Listing unresolved questions", run: async () => storeFindings(packet, await generateUnresolvedQuestions(packet)) },
    ];

    for (const step of steps) {
      updateAnalysis(investigationId, { phase: step.phase });
      try {
        const result = await step.run();
        const current = analysisProgress(investigationId);
        updateAnalysis(investigationId, {
          findingsSaved: current.findingsSaved + result.saved,
          discarded: current.discarded + result.discarded,
        });
      } catch (error) {
        const current = analysisProgress(investigationId);
        updateAnalysis(investigationId, {
          errors: [...current.errors, scrubText(error instanceof Error ? error.message : "An analysis step failed.")].slice(-8),
        });
        reportOperationFailure("ollama", error, investigationId);
      }
    }
    finishAnalysis(investigationId, "completed", "Analysis finished");
  } catch (error) {
    updateAnalysis(investigationId, {
      errors: [scrubText(error instanceof Error ? error.message : "Analysis failed.")],
    });
    reportOperationFailure("ollama", error, investigationId);
    finishAnalysis(investigationId, "failed", "Analysis stopped");
  }
}
