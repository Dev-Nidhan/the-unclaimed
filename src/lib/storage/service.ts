import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createArtifactRecord,
  deleteArtifactRecord,
  getArtifactRecord,
  listArtifactRecords,
} from "../db/queries";
import { reportOperationFailure } from "../sentry/report";
import { readStorageConfig } from "./config";
import { assertArtifactFile, isLocalStorageKey, storageKeyFor } from "./files";
import { deleteLocalObject, readLocalObject, writeLocalObject } from "./local";
import { createSpacesClient, deleteSpacesObject, presignSpacesDownload, putSpacesObject } from "./spaces";

export function artifactRoot(): string {
  return path.join(process.cwd(), ".data", "artifacts");
}

function requireProductionObjectStorage(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DigitalOcean Spaces must be configured before storing or opening investigation artifacts in production.");
  }
}

async function removeObject(storageKey: string): Promise<void> {
  const config = readStorageConfig(artifactRoot());
  if (isLocalStorageKey(storageKey)) {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    await deleteLocalObject(config.localRoot, storageKey);
    return;
  }
  if (!config.spaces) {
    return;
  }
  await deleteSpacesObject(createSpacesClient(config.spaces), config.spaces.bucket, storageKey);
}

export async function storeInvestigationArtifact(input: {
  investigationId: string;
  sourceId: string;
  kind: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const file = assertArtifactFile({
    kind: input.kind,
    filename: input.filename,
    mimeType: input.mimeType,
    byteLength: input.bytes.length,
  });
  const config = readStorageConfig(artifactRoot());
  if (config.mode === "local") {
    requireProductionObjectStorage();
  }
  const artifactId = randomUUID();
  const storageKey = storageKeyFor({
    investigationId: input.investigationId,
    sourceId: input.sourceId,
    artifactId,
    filename: file.filename,
    local: config.mode === "local",
  });
  try {
    if (config.mode === "spaces" && config.spaces) {
      await putSpacesObject(createSpacesClient(config.spaces), config.spaces.bucket, storageKey, input.bytes, file.mimeType);
    } else {
      await writeLocalObject(config.localRoot, storageKey, input.bytes);
    }
    try {
      return await createArtifactRecord({
        id: artifactId,
        investigationId: input.investigationId,
        sourceId: input.sourceId,
        filename: file.filename,
        storageKey,
        mimeType: file.mimeType,
      });
    } catch (error) {
      await removeObject(storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    reportOperationFailure("spaces", error, input.investigationId);
    throw error;
  }
}

export async function listInvestigationArtifacts(investigationId: string) {
  const rows = await listArtifactRecords(investigationId);
  return rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    filename: row.filename,
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
    storage: isLocalStorageKey(row.storageKey) ? "local" : "spaces",
  }));
}

export async function openInvestigationArtifact(investigationId: string, artifactId: string) {
  const row = await getArtifactRecord(investigationId, artifactId);
  if (!row) {
    return null;
  }
  const config = readStorageConfig(artifactRoot());
  if (isLocalStorageKey(row.storageKey)) {
    requireProductionObjectStorage();
    const bytes = await readLocalObject(config.localRoot, row.storageKey);
    return { kind: "file" as const, filename: row.filename, mimeType: row.mimeType, bytes };
  }
  if (!config.spaces) {
    throw new Error("Spaces credentials are not configured, and this file is not in local storage.");
  }
  const url = await presignSpacesDownload(
    createSpacesClient(config.spaces),
    config.spaces.bucket,
    row.storageKey,
    row.filename,
    config.urlTtlSeconds,
  );
  return {
    kind: "redirect" as const,
    url,
    expiresAt: new Date(Date.now() + config.urlTtlSeconds * 1000).toISOString(),
  };
}

export async function removeInvestigationArtifact(investigationId: string, artifactId: string): Promise<boolean> {
  const row = await getArtifactRecord(investigationId, artifactId);
  if (!row) {
    return false;
  }
  await removeObject(row.storageKey);
  await deleteArtifactRecord(investigationId, artifactId);
  return true;
}
