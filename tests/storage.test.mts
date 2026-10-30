import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readStorageConfig } from "../src/lib/storage/config.ts";
import { assertArtifactFile, storageKeyFor } from "../src/lib/storage/files.ts";
import { deleteLocalObject, readLocalObject, writeLocalObject } from "../src/lib/storage/local.ts";

const samplePdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test("a sample PDF can be stored and read from the local fallback, then removed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "unclaimed-artifacts-"));
  const file = assertArtifactFile({
    kind: "pdf",
    mimeType: "application/pdf",
    filename: "recovered report.pdf",
    byteLength: samplePdf.length,
  });
  const storageKey = storageKeyFor({
    investigationId: "00000000-0000-4000-8000-000000000001",
    sourceId: "00000000-0000-4000-8000-000000000002",
    artifactId: "00000000-0000-4000-8000-000000000003",
    filename: file.filename,
    local: true,
  });
  await writeLocalObject(root, storageKey, samplePdf);
  const read = await readLocalObject(root, storageKey);
  assert.equal(read.equals(samplePdf), true);
  await deleteLocalObject(root, storageKey);
  await assert.rejects(() => readLocalObject(root, storageKey));
});

test("missing Spaces credentials select local storage and reject escaped keys", () => {
  const previous = {
    endpoint: process.env.SPACES_ENDPOINT,
    bucket: process.env.SPACES_BUCKET,
    key: process.env.SPACES_ACCESS_KEY,
    secret: process.env.SPACES_SECRET_KEY,
  };
  delete process.env.SPACES_ENDPOINT;
  delete process.env.SPACES_BUCKET;
  delete process.env.SPACES_ACCESS_KEY;
  delete process.env.SPACES_SECRET_KEY;
  const config = readStorageConfig("/tmp/unclaimed");
  assert.equal(config.mode, "local");
  assert.equal(config.spaces, null);
  assert.throws(() => storageKeyFor({
    investigationId: "..",
    sourceId: "source",
    artifactId: "artifact",
    filename: "file.pdf",
    local: true,
  }));
  process.env.SPACES_ENDPOINT = previous.endpoint;
  process.env.SPACES_BUCKET = previous.bucket;
  process.env.SPACES_ACCESS_KEY = previous.key;
  process.env.SPACES_SECRET_KEY = previous.secret;
});
