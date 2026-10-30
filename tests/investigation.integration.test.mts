import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import test from "node:test";
import { eq } from "drizzle-orm";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const { closeDatabase, getDb, redactDatabaseError } = await import("../src/lib/db/index.ts");
const { findingSources } = await import("../src/lib/db/schema.ts");
const {
  EvidenceError,
  checkDatabaseHealth,
  createFindingWithEvidence,
  createInvestigation,
  createObservation,
  createSource,
  deleteInvestigation,
  getInvestigationById,
} = await import("../src/lib/db/queries.ts");

test("database stores and returns an investigation", async (t) => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }

  let investigationId: string | undefined;

  try {
    const health = await checkDatabaseHealth();
    assert.deepEqual(health, { ok: true, database: "postgresql" });

    const created = await createInvestigation({
      title: "Stage 1 connection test",
      subject: "example.com",
      startingUrl: "https://example.com/forgotten",
      objective: "Confirm the investigation round trip.",
    });
    investigationId = created.id;

    const loaded = await getInvestigationById(created.id);
    assert.ok(loaded);
    assert.equal(loaded.id, created.id);
    assert.equal(loaded.title, "Stage 1 connection test");
    assert.equal(loaded.subject, "example.com");
    assert.equal(loaded.startingUrl, "https://example.com/forgotten");
    assert.equal(loaded.objective, "Confirm the investigation round trip.");
    assert.equal(loaded.status, "open");
    assert.equal(loaded.createdAt.toISOString(), created.createdAt.toISOString());
    assert.equal(loaded.updatedAt.toISOString(), created.updatedAt.toISOString());

    const source = await createSource({
      investigationId: created.id,
      url: "https://example.com/forgotten",
      canonicalUrl: "https://example.com/forgotten",
      title: "Forgotten page",
      sourceType: "website",
      discoveryMethod: "direct",
    });
    const observation = await createObservation({
      investigationId: created.id,
      sourceId: source.id,
      pageTitle: "Forgotten page",
      extractedContent: "The page is still on the server.",
      httpStatus: 200,
    });
    const expectedHash = createHash("sha256")
      .update("The page is still on the server.")
      .digest("hex");
    assert.equal(observation.contentHash, expectedHash);

    await assert.rejects(
      () =>
        createFindingWithEvidence({
          investigationId: created.id,
          title: "Unsupported conclusion",
          explanation: "This cites an observation that was never stored.",
          classification: "absence",
          sourceId: source.id,
          observationId: crypto.randomUUID(),
        }),
      EvidenceError,
    );

    const recorded = await createFindingWithEvidence({
      investigationId: created.id,
      title: "Page still responds",
      explanation: "The stored observation returned HTTP 200.",
      classification: "presence",
      sourceId: source.id,
      observationId: observation.id,
    });
    assert.equal(recorded.sourceId, source.id);
    assert.equal(recorded.observationId, observation.id);
    assert.notEqual(recorded.finding.id, observation.id);

    const links = await getDb()
      .select()
      .from(findingSources)
      .where(eq(findingSources.findingId, recorded.finding.id));
    assert.equal(links.length, 1);
    assert.equal(links[0]?.sourceId, source.id);
    assert.equal(links[0]?.observationId, observation.id);
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
    throw new Error(redactDatabaseError(error));
  } finally {
    if (investigationId) {
      await deleteInvestigation(investigationId).catch((error: unknown) => {
        t.diagnostic(redactDatabaseError(error));
      });
    }
    await closeDatabase();
  }
});
