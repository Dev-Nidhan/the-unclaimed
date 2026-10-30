import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Observations store what was collected. Findings store later conclusions.
 * A finding is only valid when finding_sources points at a stored observation.
 */

export const investigationStatuses = ["open", "investigating", "closed"] as const;
export const sourceAccessStatuses = [
  "unknown",
  "reachable",
  "accessible",
  "unreachable",
  "blocked",
  "http_404",
  "http_403",
  "redirected",
  "timeout",
  "navigation_error",
] as const;
export const archiveAvailabilityStatuses = ["unknown", "available", "missing"] as const;
export const browserSessionStatuses = ["created", "active", "closed", "failed"] as const;

export type InvestigationStatus = (typeof investigationStatuses)[number];
export type SourceAccessStatus = (typeof sourceAccessStatuses)[number];
export type ArchiveAvailabilityStatus = (typeof archiveAvailabilityStatuses)[number];
export type BrowserSessionStatus = (typeof browserSessionStatuses)[number];

function idColumn() {
  return uuid("id").primaryKey().defaultRandom();
}

function createdAtColumn() {
  return timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
}

function notBlank(name: string, column: AnyPgColumn) {
  return check(name, sql`length(btrim(${column})) > 0`);
}

function httpUrl(name: string, column: AnyPgColumn) {
  return check(name, sql`${column} ~ '^https?://[^[:space:]]+$'`);
}

export const investigations = pgTable(
  "investigations",
  {
    id: idColumn(),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    startingUrl: text("starting_url").notNull(),
    objective: text("objective").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    notBlank("investigations_title_not_blank", table.title),
    notBlank("investigations_subject_not_blank", table.subject),
    notBlank("investigations_objective_not_blank", table.objective),
    httpUrl("investigations_starting_url_http", table.startingUrl),
    check(
      "investigations_status_known",
      sql`${table.status} in ('open', 'investigating', 'closed')`,
    ),
    index("investigations_starting_url_idx").on(table.startingUrl),
    index("investigations_created_at_idx").on(table.createdAt),
    index("investigations_updated_at_idx").on(table.updatedAt),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: idColumn(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title"),
    sourceType: text("source_type").notNull(),
    discoveryMethod: text("discovery_method").notNull(),
    accessStatus: text("access_status").notNull().default("unknown"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("sources_id_investigation_unique").on(table.id, table.investigationId),
    notBlank("sources_source_type_not_blank", table.sourceType),
    notBlank("sources_discovery_method_not_blank", table.discoveryMethod),
    httpUrl("sources_url_http", table.url),
    httpUrl("sources_canonical_url_http", table.canonicalUrl),
    check(
      "sources_access_status_known",
      sql`${table.accessStatus} in ('unknown', 'reachable', 'accessible', 'unreachable', 'blocked', 'http_404', 'http_403', 'redirected', 'timeout', 'navigation_error')`,
    ),
    index("sources_investigation_id_idx").on(table.investigationId),
    index("sources_url_idx").on(table.url),
    index("sources_canonical_url_idx").on(table.canonicalUrl),
    index("sources_created_at_idx").on(table.createdAt),
  ],
);

export const observations = pgTable(
  "observations",
  {
    id: idColumn(),
    sourceId: uuid("source_id").notNull(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    pageTitle: text("page_title"),
    extractedContent: text("extracted_content").notNull(),
    contentHash: text("content_hash").notNull(),
    httpStatus: integer("http_status"),
  },
  (table) => [
    unique("observations_id_source_unique").on(table.id, table.sourceId),
    foreignKey({
      name: "observations_source_investigation_fk",
      columns: [table.sourceId, table.investigationId],
      foreignColumns: [sources.id, sources.investigationId],
    }).onDelete("cascade"),
    notBlank("observations_extracted_content_not_blank", table.extractedContent),
    check("observations_content_hash_hex", sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
    check(
      "observations_http_status_range",
      sql`${table.httpStatus} is null or (${table.httpStatus} between 100 and 599)`,
    ),
    index("observations_investigation_id_idx").on(table.investigationId),
    index("observations_source_id_idx").on(table.sourceId),
    index("observations_observed_at_idx").on(table.observedAt),
  ],
);

export const archiveCaptures = pgTable(
  "archive_captures",
  {
    id: idColumn(),
    sourceId: uuid("source_id").notNull(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    archiveUrl: text("archive_url").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull(),
    originalUrl: text("original_url").notNull(),
    availabilityStatus: text("availability_status").notNull().default("unknown"),
  },
  (table) => [
    foreignKey({
      name: "archive_captures_source_investigation_fk",
      columns: [table.sourceId, table.investigationId],
      foreignColumns: [sources.id, sources.investigationId],
    }).onDelete("cascade"),
    httpUrl("archive_captures_archive_url_http", table.archiveUrl),
    httpUrl("archive_captures_original_url_http", table.originalUrl),
    check(
      "archive_captures_availability_known",
      sql`${table.availabilityStatus} in ('unknown', 'available', 'missing')`,
    ),
    index("archive_captures_investigation_id_idx").on(table.investigationId),
    index("archive_captures_source_id_idx").on(table.sourceId),
    index("archive_captures_archive_url_idx").on(table.archiveUrl),
    index("archive_captures_original_url_idx").on(table.originalUrl),
    index("archive_captures_captured_at_idx").on(table.capturedAt),
  ],
);

export const findings = pgTable(
  "findings",
  {
    id: idColumn(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    classification: text("classification").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("findings_id_investigation_unique").on(table.id, table.investigationId),
    notBlank("findings_title_not_blank", table.title),
    notBlank("findings_explanation_not_blank", table.explanation),
    notBlank("findings_classification_not_blank", table.classification),
    index("findings_investigation_id_idx").on(table.investigationId),
    index("findings_created_at_idx").on(table.createdAt),
  ],
);

export const findingSources = pgTable(
  "finding_sources",
  {
    findingId: uuid("finding_id")
      .notNull()
      .references(() => findings.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    observationId: uuid("observation_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "finding_sources_pk",
      columns: [table.findingId, table.sourceId, table.observationId],
    }),
    foreignKey({
      name: "finding_sources_observation_source_fk",
      columns: [table.observationId, table.sourceId],
      foreignColumns: [observations.id, observations.sourceId],
    }).onDelete("cascade"),
    index("finding_sources_source_id_idx").on(table.sourceId),
    index("finding_sources_observation_id_idx").on(table.observationId),
  ],
);

export const entities = pgTable(
  "entities",
  {
    id: idColumn(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    entityType: text("entity_type").notNull(),
    description: text("description"),
  },
  (table) => [
    unique("entities_id_investigation_unique").on(table.id, table.investigationId),
    notBlank("entities_name_not_blank", table.name),
    notBlank("entities_entity_type_not_blank", table.entityType),
    index("entities_investigation_id_idx").on(table.investigationId),
  ],
);

export const relationships = pgTable(
  "relationships",
  {
    id: idColumn(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    fromEntityId: uuid("from_entity_id").notNull(),
    toEntityId: uuid("to_entity_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    evidenceSourceId: uuid("evidence_source_id").notNull(),
  },
  (table) => [
    foreignKey({
      name: "relationships_from_entity_fk",
      columns: [table.fromEntityId, table.investigationId],
      foreignColumns: [entities.id, entities.investigationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "relationships_to_entity_fk",
      columns: [table.toEntityId, table.investigationId],
      foreignColumns: [entities.id, entities.investigationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "relationships_evidence_source_fk",
      columns: [table.evidenceSourceId, table.investigationId],
      foreignColumns: [sources.id, sources.investigationId],
    }).onDelete("cascade"),
    check("relationships_entities_distinct", sql`${table.fromEntityId} <> ${table.toEntityId}`),
    notBlank("relationships_type_not_blank", table.relationshipType),
    index("relationships_investigation_id_idx").on(table.investigationId),
    index("relationships_from_entity_id_idx").on(table.fromEntityId),
    index("relationships_to_entity_id_idx").on(table.toEntityId),
    index("relationships_evidence_source_id_idx").on(table.evidenceSourceId),
  ],
);

export const browserSessions = pgTable(
  "browser_sessions",
  {
    id: idColumn(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    browserbaseSessionId: text("browserbase_session_id").notNull(),
    status: text("status").notNull().default("created"),
    createdAt: createdAtColumn(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("browser_sessions_browserbase_session_id_unique").on(table.browserbaseSessionId),
    notBlank("browser_sessions_browserbase_id_not_blank", table.browserbaseSessionId),
    check(
      "browser_sessions_status_known",
      sql`${table.status} in ('created', 'active', 'closed', 'failed')`,
    ),
    index("browser_sessions_investigation_id_idx").on(table.investigationId),
    index("browser_sessions_created_at_idx").on(table.createdAt),
  ],
);

export const presenceEvents = pgTable(
  "presence_events",
  {
    id: idColumn(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    intensity: integer("intensity").notNull(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    notBlank("presence_events_event_type_not_blank", table.eventType),
    check("presence_events_intensity_range", sql`${table.intensity} between 0 and 100`),
    index("presence_events_investigation_id_idx").on(table.investigationId),
    index("presence_events_triggered_at_idx").on(table.triggeredAt),
  ],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: idColumn(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    foreignKey({
      name: "artifacts_source_investigation_fk",
      columns: [table.sourceId, table.investigationId],
      foreignColumns: [sources.id, sources.investigationId],
    }).onDelete("cascade"),
    unique("artifacts_storage_key_unique").on(table.storageKey),
    notBlank("artifacts_filename_not_blank", table.filename),
    notBlank("artifacts_storage_key_not_blank", table.storageKey),
    notBlank("artifacts_mime_type_not_blank", table.mimeType),
    index("artifacts_investigation_id_idx").on(table.investigationId),
    index("artifacts_source_id_idx").on(table.sourceId),
    index("artifacts_created_at_idx").on(table.createdAt),
  ],
);

export type Investigation = typeof investigations.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Observation = typeof observations.$inferSelect;
export type Finding = typeof findings.$inferSelect;
