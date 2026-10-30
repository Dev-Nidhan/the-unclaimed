import { relations } from "drizzle-orm";
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
} from "./schema";

export const investigationsRelations = relations(investigations, ({ many }) => ({
  sources: many(sources),
  observations: many(observations),
  archiveCaptures: many(archiveCaptures),
  findings: many(findings),
  entities: many(entities),
  relationships: many(relationships),
  browserSessions: many(browserSessions),
  presenceEvents: many(presenceEvents),
  artifacts: many(artifacts),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  investigation: one(investigations, {
    fields: [sources.investigationId],
    references: [investigations.id],
  }),
  observations: many(observations),
  archiveCaptures: many(archiveCaptures),
  findingSources: many(findingSources),
  relationships: many(relationships),
  artifacts: many(artifacts),
}));

export const observationsRelations = relations(observations, ({ one, many }) => ({
  investigation: one(investigations, {
    fields: [observations.investigationId],
    references: [investigations.id],
  }),
  source: one(sources, {
    fields: [observations.sourceId],
    references: [sources.id],
  }),
  findingSources: many(findingSources),
}));

export const archiveCapturesRelations = relations(archiveCaptures, ({ one }) => ({
  investigation: one(investigations, {
    fields: [archiveCaptures.investigationId],
    references: [investigations.id],
  }),
  source: one(sources, {
    fields: [archiveCaptures.sourceId],
    references: [sources.id],
  }),
}));

export const findingsRelations = relations(findings, ({ one, many }) => ({
  investigation: one(investigations, {
    fields: [findings.investigationId],
    references: [investigations.id],
  }),
  evidence: many(findingSources),
}));

export const findingSourcesRelations = relations(findingSources, ({ one }) => ({
  finding: one(findings, {
    fields: [findingSources.findingId],
    references: [findings.id],
  }),
  source: one(sources, {
    fields: [findingSources.sourceId],
    references: [sources.id],
  }),
  observation: one(observations, {
    fields: [findingSources.observationId],
    references: [observations.id],
  }),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  investigation: one(investigations, {
    fields: [entities.investigationId],
    references: [investigations.id],
  }),
  outgoingRelationships: many(relationships, { relationName: "relationshipFromEntity" }),
  incomingRelationships: many(relationships, { relationName: "relationshipToEntity" }),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  investigation: one(investigations, {
    fields: [relationships.investigationId],
    references: [investigations.id],
  }),
  fromEntity: one(entities, {
    fields: [relationships.fromEntityId],
    references: [entities.id],
    relationName: "relationshipFromEntity",
  }),
  toEntity: one(entities, {
    fields: [relationships.toEntityId],
    references: [entities.id],
    relationName: "relationshipToEntity",
  }),
  evidenceSource: one(sources, {
    fields: [relationships.evidenceSourceId],
    references: [sources.id],
  }),
}));

export const browserSessionsRelations = relations(browserSessions, ({ one }) => ({
  investigation: one(investigations, {
    fields: [browserSessions.investigationId],
    references: [investigations.id],
  }),
}));

export const presenceEventsRelations = relations(presenceEvents, ({ one }) => ({
  investigation: one(investigations, {
    fields: [presenceEvents.investigationId],
    references: [investigations.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  investigation: one(investigations, {
    fields: [artifacts.investigationId],
    references: [investigations.id],
  }),
  source: one(sources, {
    fields: [artifacts.sourceId],
    references: [sources.id],
  }),
}));
