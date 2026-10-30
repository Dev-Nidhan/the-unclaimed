import { canonicalizeUrl } from "../discovery/canonicalize";

/**
 * Nodes and edges come only from stored rows.
 * A capture timestamp is historical. A discovery, observation, or finding timestamp is when this investigation recorded it.
 */

export const nodeKinds = [
  "website",
  "archived-page",
  "document",
  "organization",
  "project",
  "person",
  "entity",
  "missing",
] as const;

export const nodeStates = ["accessible", "archived", "inaccessible", "unresolved", "historical"] as const;

export const edgeKinds = [
  "references",
  "links-to",
  "published-by",
  "related-to",
  "archived-as",
  "possible-continuation",
] as const;

export const timelineCategories = [
  "discovery",
  "capture",
  "observation",
  "change",
  "finding",
  "unresolved",
] as const;

export type NodeKind = (typeof nodeKinds)[number];
export type NodeState = (typeof nodeStates)[number];
export type EdgeKind = (typeof edgeKinds)[number];
export type TimelineCategory = (typeof timelineCategories)[number];
export type DateKind = "historical" | "observed";

export const nodeKindLabels: Record<NodeKind, string> = {
  website: "Original website",
  "archived-page": "Archived page",
  document: "Document",
  organization: "Organization",
  project: "Open-source project",
  person: "Person",
  entity: "Entity",
  missing: "Missing or inaccessible",
};

export const nodeStateLabels: Record<NodeState, string> = {
  accessible: "Accessible",
  archived: "Archived",
  inaccessible: "Inaccessible",
  unresolved: "Unresolved",
  historical: "Historical",
};

export const edgeKindLabels: Record<EdgeKind, string> = {
  references: "References",
  "links-to": "Links to",
  "published-by": "Published by",
  "related-to": "Related to",
  "archived-as": "Archived as",
  "possible-continuation": "Possible continuation of",
};

export const timelineCategoryLabels: Record<TimelineCategory, string> = {
  discovery: "Source discovery",
  capture: "Historical capture",
  observation: "Observation",
  change: "Confirmed change",
  finding: "Finding",
  unresolved: "Unresolved",
};

const inaccessibleStatuses = new Set([
  "unreachable",
  "blocked",
  "http_404",
  "http_403",
  "timeout",
  "navigation_error",
]);

const relationshipKinds: Record<string, EdgeKind> = {
  references: "references",
  "links to": "links-to",
  "published by": "published-by",
  "related to": "related-to",
  "archived as": "archived-as",
  "possible continuation of": "possible-continuation",
};

export type GraphSource = {
  id: string;
  url: string;
  canonicalUrl: string;
  title: string | null;
  sourceType: string;
  accessStatus: string;
  createdAt: string;
};

export type GraphObservation = {
  id: string;
  sourceId: string;
  observedAt: string;
  pageTitle: string | null;
  httpStatus: number | null;
  contentHash: string;
  extractedContent: string;
};

export type GraphArchive = {
  id: string;
  sourceId: string;
  archiveUrl: string;
  originalUrl: string;
  capturedAt: string;
  availabilityStatus: string;
};

export type GraphFinding = {
  id: string;
  title: string;
  explanation: string;
  classification: string;
  createdAt: string;
  evidence: Array<{ sourceId: string; observationId: string }>;
};

export type GraphEntity = {
  id: string;
  name: string;
  entityType: string;
  description: string | null;
};

export type GraphRelationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;
  evidenceSourceId: string;
};

export type GraphInput = {
  sources: GraphSource[];
  observations: GraphObservation[];
  archives: GraphArchive[];
  findings: GraphFinding[];
  entities: GraphEntity[];
  relationships: GraphRelationship[];
};

export type RecordedObservation = {
  id: string;
  observedAt: string;
  pageTitle: string | null;
  httpStatus: number | null;
  excerpt: string;
};

export type RecordedCapture = {
  id: string;
  capturedAt: string;
  archiveUrl: string | null;
  availabilityStatus: string;
};

export type RecordedFinding = {
  id: string;
  title: string;
  classification: string;
  explanation: string;
  observationIds: string[];
};

export type WithheldRelationship = {
  id: string;
  relationshipType: string;
  evidenceSourceId: string;
  otherName: string;
};

export type EvidenceNodeData = {
  label: string;
  kind: NodeKind;
  state: NodeState;
  url: string | null;
  evidence: string[];
  observations: RecordedObservation[];
  historicalCaptures: RecordedCapture[];
  findings: RecordedFinding[];
  withheldRelationships: WithheldRelationship[];
};

export type EvidenceGraphNode = {
  id: string;
  position: { x: number; y: number };
  data: EvidenceNodeData;
};

export type EvidenceGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  evidence: string;
};

export type TimelineEvent = {
  id: string;
  at: string;
  dateKind: DateKind;
  category: TimelineCategory;
  title: string;
  detail: string;
};

export type EvidenceModel = {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  events: TimelineEvent[];
};

export function formatRecordedDate(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) {
    return "Unknown date";
  }
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(time) + " UTC"
  );
}

export function dateKindLabel(kind: DateKind): string {
  return kind === "historical" ? "Historical date" : "Observed by this investigation";
}

export function storedOutgoingLinks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "Outgoing links:");
  if (start < 0) {
    return [];
  }
  const links: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || !line.startsWith("- ")) {
      break;
    }
    const value = line.slice(2).trim();
    if (value.startsWith("http://") || value.startsWith("https://")) {
      links.push(value);
    }
  }
  return links;
}

function entityKind(entityType: string): NodeKind {
  switch (entityType.trim().toLowerCase()) {
    case "person":
    case "people":
    case "human":
      return "person";
    case "organization":
    case "organisation":
    case "company":
    case "institution":
      return "organization";
    case "project":
    case "open-source project":
    case "open source project":
    case "repository":
      return "project";
    case "document":
    case "paper":
    case "report":
    case "file":
      return "document";
    default:
      return "entity";
  }
}

function isDocumentUrl(url: string): boolean {
  const canonical = canonicalizeUrl(url);
  if (!canonical) {
    return false;
  }
  return /\.(pdf|docx?|txt|md)$/i.test(new URL(canonical).pathname);
}

function sourceKind(source: GraphSource): NodeKind {
  const type = source.sourceType.trim().toLowerCase();
  if (type === "document" || isDocumentUrl(source.url) || isDocumentUrl(source.canonicalUrl)) {
    return "document";
  }
  return "website";
}

function sourceState(source: GraphSource, hasAvailableArchive: boolean): NodeState {
  if (source.accessStatus === "accessible" || source.accessStatus === "reachable") {
    return "accessible";
  }
  if (inaccessibleStatuses.has(source.accessStatus)) {
    return "inaccessible";
  }
  if (hasAvailableArchive) {
    return "archived";
  }
  return "unresolved";
}

function relationshipKind(value: string): EdgeKind | null {
  return relationshipKinds[value.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
}

function sourceLabel(source: GraphSource): string {
  const title = source.title?.trim();
  return title || source.url;
}

function findingsFor(sourceId: string, findings: GraphFinding[]): RecordedFinding[] {
  const related: RecordedFinding[] = [];
  for (const finding of findings) {
    const links = finding.evidence.filter((item) => item.sourceId === sourceId);
    if (links.length === 0) {
      continue;
    }
    related.push({
      id: finding.id,
      title: finding.title,
      classification: finding.classification,
      explanation: finding.explanation,
      observationIds: links.map((link) => link.observationId),
    });
  }
  return related;
}

function observationViews(observations: GraphObservation[]): RecordedObservation[] {
  return observations.map((observation) => ({
    id: observation.id,
    observedAt: observation.observedAt,
    pageTitle: observation.pageTitle,
    httpStatus: observation.httpStatus,
    excerpt: observation.extractedContent.trim().replace(/\s+/g, " ").slice(0, 420),
  }));
}

function captureView(archive: GraphArchive): RecordedCapture {
  return {
    id: archive.id,
    capturedAt: archive.capturedAt,
    archiveUrl: archive.availabilityStatus === "available" ? archive.archiveUrl : null,
    availabilityStatus: archive.availabilityStatus,
  };
}

function placeNodes(nodes: EvidenceGraphNode[]): EvidenceGraphNode[] {
  const rows = new Map<NodeKind, number>();
  return nodes.map((node) => {
    const column = nodeKinds.indexOf(node.data.kind);
    const row = rows.get(node.data.kind) ?? 0;
    rows.set(node.data.kind, row + 1);
    return { ...node, position: { x: column * 280, y: row * 150 } };
  });
}

function timeline(input: GraphInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const sources = new Map(input.sources.map((source) => [source.id, source]));

  for (const source of input.sources) {
    events.push({
      id: `discovery:${source.id}`,
      at: source.createdAt,
      dateKind: "observed",
      category: "discovery",
      title: sourceLabel(source),
      detail: "Stored when this investigation recorded the source. This is not a historical publication date.",
    });
  }

  for (const archive of input.archives) {
    const source = sources.get(archive.sourceId);
    const recovered = archive.availabilityStatus === "available";
    events.push({
      id: `capture:${archive.id}`,
      at: archive.capturedAt,
      dateKind: "historical",
      category: "capture",
      title: source ? sourceLabel(source) : archive.originalUrl,
      detail: recovered
        ? "Historical capture timestamp from the stored archive row. The snapshot URL was stored as available."
        : `Historical capture timestamp stored with availability ${archive.availabilityStatus}. The snapshot was not recovered.`,
    });
  }

  const bySource = new Map<string, GraphObservation[]>();
  for (const observation of input.observations) {
    events.push({
      id: `observation:${observation.id}`,
      at: observation.observedAt,
      dateKind: "observed",
      category: "observation",
      title: observation.pageTitle?.trim() || "Page observed",
      detail: `Observation ${observation.id}. This is when the investigation read the page.`,
    });
    const group = bySource.get(observation.sourceId) ?? [];
    group.push(observation);
    bySource.set(observation.sourceId, group);
  }

  for (const group of bySource.values()) {
    const ordered = [...group].sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.id.localeCompare(right.id));
    for (let index = 1; index < ordered.length; index += 1) {
      const earlier = ordered[index - 1];
      const later = ordered[index];
      if (!earlier || !later || earlier.contentHash === later.contentHash) {
        continue;
      }
      events.push({
        id: `change:${later.id}:${earlier.id}`,
        at: later.observedAt,
        dateKind: "observed",
        category: "change",
        title: "Stored page content changed",
        detail: `Observation ${earlier.id} and observation ${later.id} stored different content hashes for the same source. Both timestamps are when this investigation read the page.`,
      });
    }
  }

  for (const finding of input.findings) {
    const unresolved = finding.classification.trim().toUpperCase() === "UNRESOLVED";
    events.push({
      id: `${unresolved ? "unresolved" : "finding"}:${finding.id}`,
      at: finding.createdAt,
      dateKind: "observed",
      category: unresolved ? "unresolved" : "finding",
      title: finding.title,
      detail: unresolved
        ? "Recorded as unresolved. The timestamp is when the finding was stored."
        : `Stored finding classified ${finding.classification}. The timestamp is when the finding was stored.`,
    });
  }

  return events
    .filter((event) => !Number.isNaN(Date.parse(event.at)))
    .sort((left, right) => left.at.localeCompare(right.at) || left.id.localeCompare(right.id));
}

export function buildEvidenceModel(input: GraphInput): EvidenceModel {
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const entityById = new Map(input.entities.map((entity) => [entity.id, entity]));
  const observationsBySource = new Map<string, GraphObservation[]>();
  for (const observation of input.observations) {
    if (!sourceById.has(observation.sourceId)) {
      continue;
    }
    const group = observationsBySource.get(observation.sourceId) ?? [];
    group.push(observation);
    observationsBySource.set(observation.sourceId, group);
  }
  const archivesBySource = new Map<string, GraphArchive[]>();
  for (const archive of input.archives) {
    if (!sourceById.has(archive.sourceId)) {
      continue;
    }
    const group = archivesBySource.get(archive.sourceId) ?? [];
    group.push(archive);
    archivesBySource.set(archive.sourceId, group);
  }

  const urlIndex = new Map<string, string>();
  const ambiguousUrls = new Set<string>();
  for (const source of input.sources) {
    for (const key of [source.canonicalUrl, canonicalizeUrl(source.url)]) {
      if (!key) {
        continue;
      }
      const existing = urlIndex.get(key);
      if (existing && existing !== source.id) {
        ambiguousUrls.add(key);
      } else {
        urlIndex.set(key, source.id);
      }
    }
  }

  const nodes: EvidenceGraphNode[] = [];

  for (const source of input.sources) {
    const archives = archivesBySource.get(source.id) ?? [];
    const observations = observationsBySource.get(source.id) ?? [];
    const available = archives.some((archive) => archive.availabilityStatus === "available");
    nodes.push({
      id: `source:${source.id}`,
      position: { x: 0, y: 0 },
      data: {
        label: sourceLabel(source),
        kind: sourceKind(source),
        state: sourceState(source, available),
        url: source.url,
        evidence: [`Source ${source.id} stored with access status ${source.accessStatus}.`],
        observations: observationViews(observations),
        historicalCaptures: archives.map(captureView),
        findings: findingsFor(source.id, input.findings),
        withheldRelationships: [],
      },
    });
  }

  for (const archive of input.archives) {
    const source = sourceById.get(archive.sourceId);
    if (!source) {
      continue;
    }
    const available = archive.availabilityStatus === "available";
    const missing = archive.availabilityStatus === "missing";
    nodes.push({
      id: `archive:${archive.id}`,
      position: { x: 0, y: 0 },
      data: {
        label: available ? `Snapshot of ${sourceLabel(source)}` : `Unrecovered snapshot of ${sourceLabel(source)}`,
        kind: available ? "archived-page" : "missing",
        state: available ? "historical" : missing ? "inaccessible" : "unresolved",
        url: archive.originalUrl,
        evidence: [
          available
            ? `Archive capture ${archive.id} is stored as available for source ${source.id}.`
            : `Archive capture ${archive.id} is stored for source ${source.id} with availability ${archive.availabilityStatus}. The snapshot was not recovered.`,
        ],
        observations: observationViews(observationsBySource.get(source.id) ?? []),
        historicalCaptures: [captureView(archive)],
        findings: findingsFor(source.id, input.findings),
        withheldRelationships: [],
      },
    });
  }

  const edges: EvidenceGraphEdge[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const archive of input.archives) {
    if (archive.availabilityStatus !== "available") {
      continue;
    }
    const source = `source:${archive.sourceId}`;
    const target = `archive:${archive.id}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      continue;
    }
    edges.push({
      id: `archived:${archive.id}`,
      source,
      target,
      kind: "archived-as",
      evidence: `Archive capture ${archive.id} is stored as available for source ${archive.sourceId}.`,
    });
  }

  const linkEvidence = new Map<string, { from: string; to: string; observationIds: string[] }>();
  for (const observation of input.observations) {
    if (!sourceById.has(observation.sourceId)) {
      continue;
    }
    for (const link of storedOutgoingLinks(observation.extractedContent)) {
      const key = canonicalizeUrl(link);
      if (!key || ambiguousUrls.has(key)) {
        continue;
      }
      const targetId = urlIndex.get(key);
      if (!targetId || targetId === observation.sourceId) {
        continue;
      }
      const edgeKey = `${observation.sourceId}\n${targetId}`;
      const cited = linkEvidence.get(edgeKey) ?? {
        from: observation.sourceId,
        to: targetId,
        observationIds: [],
      };
      if (!cited.observationIds.includes(observation.id)) {
        cited.observationIds.push(observation.id);
      }
      linkEvidence.set(edgeKey, cited);
    }
  }
  for (const cited of linkEvidence.values()) {
    edges.push({
      id: `links:${cited.from}:${cited.to}`,
      source: `source:${cited.from}`,
      target: `source:${cited.to}`,
      kind: "links-to",
      evidence: `Observation ${cited.observationIds.join(", ")} lists the target URL under Outgoing links.`,
    });
  }

  const withheldByEntity = new Map<string, WithheldRelationship[]>();
  for (const relationship of input.relationships) {
    const from = entityById.get(relationship.fromEntityId);
    const to = entityById.get(relationship.toEntityId);
    const evidenceSource = sourceById.get(relationship.evidenceSourceId);
    if (!from || !to || !evidenceSource || from.id === to.id) {
      continue;
    }
    const kind = relationshipKind(relationship.relationshipType);
    if (!kind) {
      const note: WithheldRelationship = {
        id: relationship.id,
        relationshipType: relationship.relationshipType,
        evidenceSourceId: evidenceSource.id,
        otherName: "",
      };
      const fromNotes = withheldByEntity.get(from.id) ?? [];
      fromNotes.push({ ...note, otherName: to.name });
      withheldByEntity.set(from.id, fromNotes);
      const toNotes = withheldByEntity.get(to.id) ?? [];
      toNotes.push({ ...note, otherName: from.name });
      withheldByEntity.set(to.id, toNotes);
      continue;
    }
    edges.push({
      id: `relationship:${relationship.id}`,
      source: `entity:${from.id}`,
      target: `entity:${to.id}`,
      kind,
      evidence: `Relationship ${relationship.id} cites source ${evidenceSource.id}.`,
    });
  }

  for (const entity of input.entities) {
    nodes.push({
      id: `entity:${entity.id}`,
      position: { x: 0, y: 0 },
      data: {
        label: entity.name,
        kind: entityKind(entity.entityType),
        state: "unresolved",
        url: null,
        evidence: [
          entity.description?.trim() ||
            `Entity ${entity.id} is stored with type ${entity.entityType}. No page access was recorded for this name.`,
        ],
        observations: [],
        historicalCaptures: [],
        findings: [],
        withheldRelationships: withheldByEntity.get(entity.id) ?? [],
      },
    });
  }

  const entityIds = new Set(input.entities.map((entity) => `entity:${entity.id}`));
  const keptEdges = edges.filter((edge) => {
    if (edge.id.startsWith("relationship:")) {
      return entityIds.has(edge.source) && entityIds.has(edge.target);
    }
    return nodeIds.has(edge.source) && nodeIds.has(edge.target);
  });

  return {
    nodes: placeNodes(nodes),
    edges: keptEdges,
    events: timeline(input),
  };
}
