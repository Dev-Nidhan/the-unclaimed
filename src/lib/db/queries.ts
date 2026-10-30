import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { presenceEventIds } from "../presence/events";
import { getDb, getSql } from "./index";
import {
  archiveCaptures,
  artifacts,
  browserSessions,
  entities,
  findingSources,
  findings,
  investigations,
  observations,
  presenceEvents,
  relationships,
  sources,
  investigationStatuses,
  sourceAccessStatuses,
  type Finding,
  type Investigation,
  type Observation,
  type Source,
} from "./schema";

const investigationInput = z.object({
  title: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  startingUrl: z.url(),
  objective: z.string().trim().min(1),
  status: z.enum(investigationStatuses).optional(),
});

const sourceInput = z.object({
  investigationId: z.uuid(),
  url: z.url(),
  canonicalUrl: z.url(),
  title: z.string().trim().min(1).nullable().optional(),
  sourceType: z.string().trim().min(1),
  discoveryMethod: z.string().trim().min(1),
  accessStatus: z.enum(sourceAccessStatuses).optional(),
});

const observationInput = z.object({
  investigationId: z.uuid(),
  sourceId: z.uuid(),
  pageTitle: z.string().trim().min(1).nullable().optional(),
  extractedContent: z.string().trim().min(1),
  httpStatus: z.number().int().min(100).max(599).nullable().optional(),
  observedAt: z.date().optional(),
});

const findingInput = z.object({
  investigationId: z.uuid(),
  title: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  classification: z.string().trim().min(1),
  sourceId: z.uuid(),
  observationId: z.uuid(),
});

export type CreateInvestigationInput = z.infer<typeof investigationInput>;
export type CreateSourceInput = z.infer<typeof sourceInput>;
export type CreateObservationInput = z.infer<typeof observationInput>;
export type CreateFindingInput = z.infer<typeof findingInput>;

export class EvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceError";
  }
}

export async function checkDatabaseHealth(): Promise<{ ok: true; database: "postgresql" }> {
  const rows = await getSql()`select 1 as ok`;
  const value = rows[0]?.ok;
  if (Number(value) !== 1) {
    throw new Error("Database health check returned an unexpected result.");
  }
  return { ok: true, database: "postgresql" };
}

export async function createInvestigation(input: CreateInvestigationInput): Promise<Investigation> {
  const data = investigationInput.parse(input);
  const [investigation] = await getDb()
    .insert(investigations)
    .values({
      title: data.title,
      subject: data.subject,
      startingUrl: data.startingUrl,
      objective: data.objective,
      status: data.status ?? "open",
    })
    .returning();

  if (!investigation) {
    throw new Error("Investigation insert did not return a row.");
  }
  return investigation;
}

export async function findInvestigationByStartingUrl(startingUrl: string): Promise<Investigation | null> {
  const [investigation] = await getDb()
    .select()
    .from(investigations)
    .where(eq(investigations.startingUrl, startingUrl))
    .orderBy(asc(investigations.createdAt))
    .limit(1);
  return investigation ?? null;
}

export async function investigationHasObservation(investigationId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: observations.id })
    .from(observations)
    .where(eq(observations.investigationId, investigationId))
    .limit(1);
  return Boolean(row);
}

export async function getInvestigationById(id: string): Promise<Investigation | null> {
  const investigationId = z.uuid().parse(id);
  const [investigation] = await getDb()
    .select()
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1);
  return investigation ?? null;
}

export async function setInvestigationStatus(
  id: string,
  status: (typeof investigationStatuses)[number],
): Promise<void> {
  const investigationId = z.uuid().parse(id);
  await getDb()
    .update(investigations)
    .set({ status, updatedAt: new Date() })
    .where(eq(investigations.id, investigationId));
}

export async function openBrowserSession(investigationId: string) {
  const [session] = await getDb()
    .select()
    .from(browserSessions)
    .where(
      and(
        eq(browserSessions.investigationId, investigationId),
        inArray(browserSessions.status, ["created", "active"]),
      ),
    )
    .orderBy(desc(browserSessions.createdAt))
    .limit(1);
  return session ?? null;
}

export async function insertBrowserSession(investigationId: string, browserbaseSessionId: string) {
  const [session] = await getDb()
    .insert(browserSessions)
    .values({
      investigationId,
      browserbaseSessionId,
      status: "created",
    })
    .returning();
  if (!session) {
    throw new Error("Browser session insert did not return a row.");
  }
  return session;
}

export async function markBrowserSession(id: string, status: "active" | "closed" | "failed") {
  await getDb()
    .update(browserSessions)
    .set({
      status,
      closedAt: status === "active" ? null : new Date(),
    })
    .where(eq(browserSessions.id, id));
}

export async function deleteInvestigation(id: string): Promise<void> {
  const investigationId = z.uuid().parse(id);
  await getDb().delete(investigations).where(eq(investigations.id, investigationId));
}

export async function createSource(input: CreateSourceInput): Promise<Source> {
  const data = sourceInput.parse(input);
  const [source] = await getDb()
    .insert(sources)
    .values({
      investigationId: data.investigationId,
      url: data.url,
      canonicalUrl: data.canonicalUrl,
      title: data.title ?? null,
      sourceType: data.sourceType,
      discoveryMethod: data.discoveryMethod,
      accessStatus: data.accessStatus ?? "unknown",
    })
    .returning();

  if (!source) {
    throw new Error("Source insert did not return a row.");
  }
  return source;
}

export async function listInvestigationSources(investigationId: string): Promise<Source[]> {
  return getDb().select().from(sources).where(eq(sources.investigationId, investigationId));
}

export async function findSourceByCanonical(
  investigationId: string,
  canonicalUrl: string,
): Promise<Source | null> {
  const [source] = await getDb()
    .select()
    .from(sources)
    .where(and(eq(sources.investigationId, investigationId), eq(sources.canonicalUrl, canonicalUrl)))
    .limit(1);
  return source ?? null;
}

export async function updateSourceVisit(
  id: string,
  patch: {
    accessStatus: (typeof sourceAccessStatuses)[number];
    title?: string | null;
    url?: string;
    canonicalUrl?: string;
  },
): Promise<void> {
  await getDb()
    .update(sources)
    .set({
      accessStatus: patch.accessStatus,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.url ? { url: patch.url } : {}),
      ...(patch.canonicalUrl ? { canonicalUrl: patch.canonicalUrl } : {}),
    })
    .where(eq(sources.id, id));
}

const archiveCaptureInput = z.object({
  investigationId: z.uuid(),
  sourceId: z.uuid(),
  archiveUrl: z.url(),
  originalUrl: z.url(),
  capturedAt: z.date(),
  availabilityStatus: z.enum(["unknown", "available", "missing"]),
});

export async function listArchiveUrls(sourceId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ archiveUrl: archiveCaptures.archiveUrl })
    .from(archiveCaptures)
    .where(eq(archiveCaptures.sourceId, sourceId));
  return rows.map((row) => row.archiveUrl);
}

export async function createArchiveCapture(input: z.infer<typeof archiveCaptureInput>) {
  const data = archiveCaptureInput.parse(input);
  const [capture] = await getDb()
    .insert(archiveCaptures)
    .values({
      investigationId: data.investigationId,
      sourceId: data.sourceId,
      archiveUrl: data.archiveUrl,
      originalUrl: data.originalUrl,
      capturedAt: data.capturedAt,
      availabilityStatus: data.availabilityStatus,
    })
    .returning();
  if (!capture) {
    throw new Error("Archive capture insert did not return a row.");
  }
  return capture;
}

export async function createObservation(input: CreateObservationInput): Promise<Observation> {
  const data = observationInput.parse(input);
  const [observation] = await getDb()
    .insert(observations)
    .values({
      investigationId: data.investigationId,
      sourceId: data.sourceId,
      pageTitle: data.pageTitle ?? null,
      extractedContent: data.extractedContent,
      contentHash: createHash("sha256").update(data.extractedContent).digest("hex"),
      httpStatus: data.httpStatus ?? null,
      observedAt: data.observedAt,
    })
    .returning();

  if (!observation) {
    throw new Error("Observation insert did not return a row.");
  }
  return observation;
}

export async function createFindingWithEvidence(
  input: CreateFindingInput,
): Promise<{ finding: Finding; sourceId: string; observationId: string }> {
  const data = findingInput.parse(input);
  const database = getDb();

  return database.transaction(async (tx) => {
    const [observation] = await tx
      .select()
      .from(observations)
      .where(eq(observations.id, data.observationId))
      .limit(1);

    if (
      !observation ||
      observation.investigationId !== data.investigationId ||
      observation.sourceId !== data.sourceId
    ) {
      throw new EvidenceError(
        "A finding must cite an observation stored for the same investigation and source.",
      );
    }

    const [finding] = await tx
      .insert(findings)
      .values({
        investigationId: data.investigationId,
        title: data.title,
        explanation: data.explanation,
        classification: data.classification,
      })
      .returning();

    if (!finding) {
      throw new Error("Finding insert did not return a row.");
    }

    await tx.insert(findingSources).values({
      findingId: finding.id,
      sourceId: data.sourceId,
      observationId: data.observationId,
    });

    return {
      finding,
      sourceId: data.sourceId,
      observationId: data.observationId,
    };
  });
}

const evidenceLink = z.object({
  sourceId: z.uuid(),
  observationId: z.uuid(),
});

const groundedFindingInput = z.object({
  investigationId: z.uuid(),
  title: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  classification: z.enum(["VERIFIED", "INFERRED", "UNRESOLVED"]),
  evidence: z.array(evidenceLink).min(1),
});

export async function createFindingWithEvidenceSet(
  input: z.infer<typeof groundedFindingInput>,
): Promise<Finding> {
  const data = groundedFindingInput.parse(input);
  return getDb().transaction(async (tx) => {
    for (const link of data.evidence) {
      const [observation] = await tx
        .select()
        .from(observations)
        .where(eq(observations.id, link.observationId))
        .limit(1);
      if (
        !observation ||
        observation.investigationId !== data.investigationId ||
        observation.sourceId !== link.sourceId
      ) {
        throw new EvidenceError(
          "A finding must cite an observation stored for the same investigation and source.",
        );
      }
    }

    const [finding] = await tx
      .insert(findings)
      .values({
        investigationId: data.investigationId,
        title: data.title,
        explanation: data.explanation,
        classification: data.classification,
      })
      .returning();
    if (!finding) {
      throw new Error("Finding insert did not return a row.");
    }
    await tx.insert(findingSources).values(
      data.evidence.map((link) => ({
        findingId: finding.id,
        sourceId: link.sourceId,
        observationId: link.observationId,
      })),
    );
    return finding;
  });
}

export async function findOrCreateEntity(input: {
  investigationId: string;
  name: string;
  entityType: string;
  description: string;
}) {
  const [existing] = await getDb()
    .select()
    .from(entities)
    .where(and(eq(entities.investigationId, input.investigationId), eq(entities.name, input.name)))
    .limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await getDb()
    .insert(entities)
    .values({
      investigationId: input.investigationId,
      name: input.name,
      entityType: input.entityType,
      description: input.description,
    })
    .returning();
  if (!created) {
    throw new Error("Entity insert did not return a row.");
  }
  return created;
}

export async function createEvidenceRelationship(input: {
  investigationId: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;
  evidenceSourceId: string;
}) {
  if (input.fromEntityId === input.toEntityId) {
    throw new EvidenceError("A relationship needs two different entities.");
  }
  const [source] = await getDb().select().from(sources).where(eq(sources.id, input.evidenceSourceId)).limit(1);
  if (!source || source.investigationId !== input.investigationId) {
    throw new EvidenceError("A relationship must cite a source from this investigation.");
  }
  const [created] = await getDb()
    .insert(relationships)
    .values({
      investigationId: input.investigationId,
      fromEntityId: input.fromEntityId,
      toEntityId: input.toEntityId,
      relationshipType: input.relationshipType,
      evidenceSourceId: input.evidenceSourceId,
    })
    .returning();
  if (!created) {
    throw new Error("Relationship insert did not return a row.");
  }
  return created;
}

const presenceInput = z.object({
  investigationId: z.uuid(),
  eventType: z.enum(presenceEventIds),
  intensity: z.number().int().min(0).max(100),
});

export async function recordPresenceEvent(input: z.infer<typeof presenceInput>) {
  const parsed = presenceInput.parse(input);
  const investigation = await getInvestigationById(parsed.investigationId);
  if (!investigation) {
    return null;
  }
  const [created] = await getDb()
    .insert(presenceEvents)
    .values({
      investigationId: parsed.investigationId,
      eventType: parsed.eventType,
      intensity: parsed.intensity,
    })
    .returning();
  return created ?? null;
}

const artifactInput = z.object({
  id: z.uuid(),
  investigationId: z.uuid(),
  sourceId: z.uuid(),
  filename: z.string().trim().min(1).max(120),
  storageKey: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(120),
});

export async function createArtifactRecord(input: z.infer<typeof artifactInput>) {
  const parsed = artifactInput.parse(input);
  const [source] = await getDb()
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.id, parsed.sourceId), eq(sources.investigationId, parsed.investigationId)))
    .limit(1);
  if (!source) {
    throw new Error("The artifact must cite a source from this investigation.");
  }
  const [created] = await getDb().insert(artifacts).values(parsed).returning();
  if (!created) {
    throw new Error("Artifact insert did not return a row.");
  }
  return created;
}

export async function listArtifactRecords(investigationId: string) {
  return getDb()
    .select()
    .from(artifacts)
    .where(eq(artifacts.investigationId, investigationId))
    .orderBy(desc(artifacts.createdAt));
}

export async function getArtifactRecord(investigationId: string, artifactId: string) {
  const [row] = await getDb()
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.investigationId, investigationId)))
    .limit(1);
  return row ?? null;
}

export async function deleteArtifactRecord(investigationId: string, artifactId: string) {
  await getDb()
    .delete(artifacts)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.investigationId, investigationId)));
}

export async function listRecentInvestigations(limit = 6): Promise<Investigation[]> {
  return getDb()
    .select()
    .from(investigations)
    .orderBy(desc(investigations.updatedAt))
    .limit(limit);
}

export async function listRecentSources(limit = 6): Promise<Source[]> {
  return getDb().select().from(sources).orderBy(desc(sources.createdAt)).limit(limit);
}

export async function listRecentObservations(limit = 6): Promise<Observation[]> {
  return getDb().select().from(observations).orderBy(desc(observations.observedAt)).limit(limit);
}

export async function getInvestigationCounts(): Promise<{
  investigations: number;
  sources: number;
  findings: number;
  observations: number;
}> {
  const database = getDb();
  const [investigationCount, sourceCount, findingCount, observationCount] = await Promise.all([
    database.select({ value: count() }).from(investigations),
    database.select({ value: count() }).from(sources),
    database.select({ value: count() }).from(findings),
    database.select({ value: count() }).from(observations),
  ]);

  return {
    investigations: Number(investigationCount[0]?.value ?? 0),
    sources: Number(sourceCount[0]?.value ?? 0),
    findings: Number(findingCount[0]?.value ?? 0),
    observations: Number(observationCount[0]?.value ?? 0),
  };
}

export async function getStoredInvestigation(id: string): Promise<{
  investigation: Investigation;
  sources: Source[];
  findings: Finding[];
  observations: Observation[];
  archives: (typeof archiveCaptures.$inferSelect)[];
  entities: (typeof entities.$inferSelect)[];
  relationships: (typeof relationships.$inferSelect)[];
  findingLinks: (typeof findingSources.$inferSelect)[];
} | null> {
  const investigation = await getInvestigationById(id);
  if (!investigation) {
    return null;
  }

  const database = getDb();
  const [sourceRows, findingRows, observationRows, archiveRows, entityRows, relationshipRows] =
    await Promise.all([
      database
        .select()
        .from(sources)
        .where(eq(sources.investigationId, investigation.id))
        .orderBy(desc(sources.createdAt)),
      database
        .select()
        .from(findings)
        .where(eq(findings.investigationId, investigation.id))
        .orderBy(desc(findings.createdAt)),
      database
        .select()
        .from(observations)
        .where(eq(observations.investigationId, investigation.id))
        .orderBy(desc(observations.observedAt)),
      database
        .select()
        .from(archiveCaptures)
        .where(eq(archiveCaptures.investigationId, investigation.id))
        .orderBy(desc(archiveCaptures.capturedAt)),
      database
        .select()
        .from(entities)
        .where(eq(entities.investigationId, investigation.id))
        .orderBy(entities.name),
      database
        .select()
        .from(relationships)
        .where(eq(relationships.investigationId, investigation.id)),
    ]);

  const findingIds = findingRows.map((finding) => finding.id);
  const findingLinks =
    findingIds.length === 0
      ? []
      : await database
          .select()
          .from(findingSources)
          .where(inArray(findingSources.findingId, findingIds));

  return {
    investigation,
    sources: sourceRows,
    findings: findingRows,
    observations: observationRows,
    archives: archiveRows,
    entities: entityRows,
    relationships: relationshipRows,
    findingLinks,
  };
}
