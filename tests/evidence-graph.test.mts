import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceModel, type GraphInput } from "../src/lib/investigations/graph.ts";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function input(patch: Partial<GraphInput> = {}): GraphInput {
  return {
    sources: [],
    observations: [],
    archives: [],
    findings: [],
    entities: [],
    relationships: [],
    ...patch,
  };
}

test("edges follow stored links, available captures, and cited relationship types", () => {
  const model = buildEvidenceModel(
    input({
      sources: [
        {
          id: "page",
          url: "https://example.com/",
          canonicalUrl: "https://example.com/",
          title: "Example Domain",
          sourceType: "visited_page",
          accessStatus: "accessible",
          createdAt: "2026-10-30T10:00:00.000Z",
        },
        {
          id: "docs",
          url: "https://example.com/docs",
          canonicalUrl: "https://example.com/docs",
          title: "Docs",
          sourceType: "visited_page",
          accessStatus: "http_404",
          createdAt: "2026-10-30T10:05:00.000Z",
        },
        {
          id: "manual",
          url: "https://example.com/manual.pdf",
          canonicalUrl: "https://example.com/manual.pdf",
          title: "Manual",
          sourceType: "visited_page",
          accessStatus: "unknown",
          createdAt: "2026-10-30T10:06:00.000Z",
        },
      ],
      observations: [
        {
          id: "obs-1",
          sourceId: "page",
          observedAt: "2026-10-30T11:00:00.000Z",
          pageTitle: "Example Domain",
          httpStatus: 200,
          contentHash: hashA,
          extractedContent: "Example Domain\n\nOutgoing links:\n- https://www.example.com/docs\n- https://www.iana.org/domains/example\n- https://example.com/",
        },
        {
          id: "obs-2",
          sourceId: "page",
          observedAt: "2026-10-30T12:00:00.000Z",
          pageTitle: "Example Domain",
          httpStatus: 200,
          contentHash: hashB,
          extractedContent: "Example Domain changed\n\nOutgoing links:\n- https://example.com/docs",
        },
      ],
      archives: [
        {
          id: "snap",
          sourceId: "page",
          archiveUrl: "https://web.archive.org/web/20140501000000/https://example.com/",
          originalUrl: "https://example.com/",
          capturedAt: "2014-05-01T00:00:00.000Z",
          availabilityStatus: "available",
        },
        {
          id: "gone",
          sourceId: "docs",
          archiveUrl: "https://web.archive.org/web/20120101000000/https://example.com/docs",
          originalUrl: "https://example.com/docs",
          capturedAt: "2012-01-01T00:00:00.000Z",
          availabilityStatus: "missing",
        },
        {
          id: "manual-snap",
          sourceId: "manual",
          archiveUrl: "https://web.archive.org/web/20190101000000/https://example.com/manual.pdf",
          originalUrl: "https://example.com/manual.pdf",
          capturedAt: "2019-01-01T00:00:00.000Z",
          availabilityStatus: "available",
        },
      ],
      findings: [
        {
          id: "open-question",
          title: "Who maintained the docs?",
          explanation: "The stored page does not say.",
          classification: "UNRESOLVED",
          createdAt: "2026-10-30T12:30:00.000Z",
          evidence: [{ sourceId: "page", observationId: "obs-2" }],
        },
      ],
      entities: [
        { id: "person", name: "Example Maintainer", entityType: "person", description: null },
        { id: "org", name: "Example Org", entityType: "organization", description: null },
        { id: "repo", name: "example-repo", entityType: "repository", description: null },
      ],
      relationships: [
        {
          id: "rel-pub",
          fromEntityId: "person",
          toEntityId: "org",
          relationshipType: "Published by",
          evidenceSourceId: "page",
        },
        {
          id: "rel-next",
          fromEntityId: "org",
          toEntityId: "repo",
          relationshipType: "Possible continuation of",
          evidenceSourceId: "docs",
        },
        {
          id: "rel-guess",
          fromEntityId: "person",
          toEntityId: "repo",
          relationshipType: "seems related",
          evidenceSourceId: "page",
        },
      ],
    }),
  );

  const kinds = model.edges.map((edge) => edge.kind).sort();
  assert.deepEqual(kinds, ["archived-as", "archived-as", "links-to", "possible-continuation", "published-by"]);
  const link = model.edges.find((edge) => edge.kind === "links-to");
  assert.equal(link?.source, "source:page");
  assert.equal(link?.target, "source:docs");
  assert.match(link?.evidence ?? "", /obs-1/);
  assert.match(link?.evidence ?? "", /obs-2/);
  assert.equal(model.nodes.some((node) => node.data.url === "https://www.iana.org/domains/example"), false);
  assert.equal(model.edges.some((edge) => edge.id === "archived:gone"), false);
  assert.equal(model.nodes.find((node) => node.id === "archive:gone")?.data.state, "inaccessible");
  assert.equal(model.nodes.find((node) => node.id === "archive:gone")?.data.historicalCaptures[0]?.archiveUrl, null);
  assert.equal(model.nodes.find((node) => node.id === "source:docs")?.data.state, "inaccessible");
  assert.equal(model.nodes.find((node) => node.id === "source:manual")?.data.kind, "document");
  assert.equal(model.nodes.find((node) => node.id === "source:manual")?.data.state, "archived");
  assert.equal(model.nodes.find((node) => node.id === "archive:snap")?.data.state, "historical");
  assert.equal(model.nodes.find((node) => node.id === "entity:person")?.data.kind, "person");
  assert.equal(model.nodes.find((node) => node.id === "entity:repo")?.data.kind, "project");
  assert.equal(
    model.nodes.find((node) => node.id === "entity:person")?.data.withheldRelationships.some((item) => item.id === "rel-guess"),
    true,
  );

  const capture = model.events.find((event) => event.id === "capture:snap");
  const discovery = model.events.find((event) => event.id === "discovery:page");
  const change = model.events.find((event) => event.category === "change");
  const unresolved = model.events.find((event) => event.id === "unresolved:open-question");
  assert.equal(capture?.dateKind, "historical");
  assert.equal(capture?.at, "2014-05-01T00:00:00.000Z");
  assert.equal(discovery?.dateKind, "observed");
  assert.equal(change?.dateKind, "observed");
  assert.match(change?.detail ?? "", /obs-1/);
  assert.equal(unresolved?.category, "unresolved");
  assert.equal(model.events.some((event) => event.category === "finding"), false);
});

test("identical stored hashes do not become a confirmed change", () => {
  const model = buildEvidenceModel(
    input({
      sources: [
        {
          id: "page",
          url: "https://example.com/",
          canonicalUrl: "https://example.com/",
          title: "Example Domain",
          sourceType: "visited_page",
          accessStatus: "accessible",
          createdAt: "2026-10-30T10:00:00.000Z",
        },
      ],
      observations: [
        {
          id: "obs-1",
          sourceId: "page",
          observedAt: "2026-10-30T11:00:00.000Z",
          pageTitle: "Example Domain",
          httpStatus: 200,
          contentHash: hashA,
          extractedContent: "Example Domain",
        },
        {
          id: "obs-2",
          sourceId: "page",
          observedAt: "2026-10-30T12:00:00.000Z",
          pageTitle: "Example Domain",
          httpStatus: 200,
          contentHash: hashA,
          extractedContent: "Example Domain",
        },
      ],
    }),
  );
  assert.equal(model.events.some((event) => event.category === "change"), false);
  assert.equal(model.edges.length, 0);
});
