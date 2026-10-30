import { connection } from "next/server";
import { redactDatabaseError } from "../redact";
import { buildEvidenceModel, type EvidenceModel, type GraphInput } from "./graph";
import {
  getInvestigationCounts,
  getStoredInvestigation,
  listRecentInvestigations,
  listRecentObservations,
  listRecentSources,
} from "../db/queries";
import type { InvestigationView } from "./types";

export function formatTimestamp(value: Date): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(value) + " UTC"
  );
}

function excerpt(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 160) {
    return compact;
  }
  return `${compact.slice(0, 157)}...`;
}

export function toInvestigationView(
  stored: NonNullable<Awaited<ReturnType<typeof getStoredInvestigation>>>,
): InvestigationView {
  const linksByFinding = new Map<string, string[]>();
  for (const link of stored.findingLinks) {
    const current = linksByFinding.get(link.findingId) ?? [];
    current.push(link.sourceId);
    linksByFinding.set(link.findingId, current);
  }

  const activity = [
    {
      id: `${stored.investigation.id}-opened`,
      label: "Record opened",
      at: formatTimestamp(stored.investigation.createdAt),
      sort: stored.investigation.createdAt.getTime(),
    },
    ...stored.sources.map((source) => ({
      id: source.id,
      label:
        source.discoveryMethod === "search"
          ? `Search lead stored${source.title ? `: ${source.title}` : ""}`
          : `Source stored${source.title ? `: ${source.title}` : ""}`,
      at: formatTimestamp(source.createdAt),
      sort: source.createdAt.getTime(),
    })),
    ...stored.observations.map((observation) => ({
      id: observation.id,
      label: `Observation stored${observation.pageTitle ? `: ${observation.pageTitle}` : ""}`,
      at: formatTimestamp(observation.observedAt),
      sort: observation.observedAt.getTime(),
    })),
    ...stored.findings.map((finding) => ({
      id: finding.id,
      label: `Finding recorded: ${finding.title}`,
      at: formatTimestamp(finding.createdAt),
      sort: finding.createdAt.getTime(),
    })),
    ...stored.archives.map((archive) => ({
      id: archive.id,
      label: `Archive capture stored: ${archive.availabilityStatus}`,
      at: formatTimestamp(archive.capturedAt),
      sort: archive.capturedAt.getTime(),
    })),
  ]
    .sort((left, right) => right.sort - left.sort)
    .map(({ id, label, at }) => ({ id, label, at }));

  return {
    mode: "stored",
    id: stored.investigation.id,
    title: stored.investigation.title,
    subject: stored.investigation.subject,
    startingUrl: stored.investigation.startingUrl,
    objective: stored.investigation.objective,
    status: stored.investigation.status,
    createdAt: formatTimestamp(stored.investigation.createdAt),
    updatedAt: formatTimestamp(stored.investigation.updatedAt),
    sources: stored.sources.map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      sourceType: source.sourceType,
      discoveryMethod: source.discoveryMethod,
      accessStatus: source.accessStatus,
      createdAt: formatTimestamp(source.createdAt),
    })),
    findings: stored.findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      explanation: finding.explanation,
      classification: finding.classification,
      createdAt: formatTimestamp(finding.createdAt),
      sourceIds: linksByFinding.get(finding.id) ?? [],
    })),
    observations: stored.observations.map((observation) => ({
      id: observation.id,
      sourceId: observation.sourceId,
      pageTitle: observation.pageTitle,
      httpStatus: observation.httpStatus,
      observedAt: formatTimestamp(observation.observedAt),
      excerpt: excerpt(observation.extractedContent),
    })),
    archives: stored.archives.map((archive) => ({
      id: archive.id,
      sourceId: archive.sourceId,
      archiveUrl: archive.archiveUrl,
      originalUrl: archive.originalUrl,
      availabilityStatus: archive.availabilityStatus,
      capturedAt: formatTimestamp(archive.capturedAt),
    })),
    entities: stored.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      entityType: entity.entityType,
      description: entity.description,
    })),
    relationships: stored.relationships.map((relationship) => ({
      id: relationship.id,
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      relationshipType: relationship.relationshipType,
    })),
    activity,
  };
}

export async function loadDashboardRecords(): Promise<
  | {
      ok: true;
      investigations: Awaited<ReturnType<typeof listRecentInvestigations>>;
      sources: Awaited<ReturnType<typeof listRecentSources>>;
      observations: Awaited<ReturnType<typeof listRecentObservations>>;
      counts: Awaited<ReturnType<typeof getInvestigationCounts>>;
    }
  | { ok: false; message: string }
> {
  try {
    const [investigations, sources, observations, counts] = await Promise.all([
      listRecentInvestigations(),
      listRecentSources(),
      listRecentObservations(),
      getInvestigationCounts(),
    ]);
    return { ok: true, investigations, sources, observations, counts };
  } catch (error) {
    return { ok: false, message: redactDatabaseError(error) };
  }
}

export function toGraphInput(
  stored: NonNullable<Awaited<ReturnType<typeof getStoredInvestigation>>>,
): GraphInput {
  const evidence = new Map<string, Array<{ sourceId: string; observationId: string }>>();
  for (const link of stored.findingLinks) {
    const current = evidence.get(link.findingId) ?? [];
    current.push({ sourceId: link.sourceId, observationId: link.observationId });
    evidence.set(link.findingId, current);
  }

  return {
    sources: stored.sources.map((source) => ({
      id: source.id,
      url: source.url,
      canonicalUrl: source.canonicalUrl,
      title: source.title,
      sourceType: source.sourceType,
      accessStatus: source.accessStatus,
      createdAt: source.createdAt.toISOString(),
    })),
    observations: stored.observations.map((observation) => ({
      id: observation.id,
      sourceId: observation.sourceId,
      observedAt: observation.observedAt.toISOString(),
      pageTitle: observation.pageTitle,
      httpStatus: observation.httpStatus,
      contentHash: observation.contentHash,
      extractedContent: observation.extractedContent,
    })),
    archives: stored.archives.map((archive) => ({
      id: archive.id,
      sourceId: archive.sourceId,
      archiveUrl: archive.archiveUrl,
      originalUrl: archive.originalUrl,
      capturedAt: archive.capturedAt.toISOString(),
      availabilityStatus: archive.availabilityStatus,
    })),
    findings: stored.findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      explanation: finding.explanation,
      classification: finding.classification,
      createdAt: finding.createdAt.toISOString(),
      evidence: evidence.get(finding.id) ?? [],
    })),
    entities: stored.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      entityType: entity.entityType,
      description: entity.description,
    })),
    relationships: stored.relationships.map((relationship) => ({
      id: relationship.id,
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      relationshipType: relationship.relationshipType,
      evidenceSourceId: relationship.evidenceSourceId,
    })),
  };
}

export async function loadEvidenceModel(id: string): Promise<
  | { ok: true; model: EvidenceModel }
  | { ok: false; missing: true }
  | { ok: false; missing: false; message: string }
> {
  await connection();
  try {
    const stored = await getStoredInvestigation(id);
    if (!stored) {
      return { ok: false, missing: true };
    }
    return { ok: true, model: buildEvidenceModel(toGraphInput(stored)) };
  } catch (error) {
    return { ok: false, missing: false, message: redactDatabaseError(error) };
  }
}

export async function loadStoredInvestigation(id: string): Promise<
  | { ok: true; view: InvestigationView }
  | { ok: false; missing: true }
  | { ok: false; missing: false; message: string }
> {
  try {
    const stored = await getStoredInvestigation(id);
    if (!stored) {
      return { ok: false, missing: true };
    }
    return { ok: true, view: toInvestigationView(stored) };
  } catch (error) {
    return { ok: false, missing: false, message: redactDatabaseError(error) };
  }
}
