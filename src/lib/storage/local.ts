import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isLocalStorageKey } from "./files";

export function localObjectPath(root: string, storageKey: string): string {
  if (!isLocalStorageKey(storageKey)) {
    throw new Error("The local storage key is not valid.");
  }
  const relative = storageKey.slice("local/".length);
  const base = path.resolve(root);
  const full = path.resolve(base, relative);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("The local storage key is not valid.");
  }
  return full;
}

export async function writeLocalObject(root: string, storageKey: string, bytes: Buffer): Promise<void> {
  const destination = localObjectPath(root, storageKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}

export async function readLocalObject(root: string, storageKey: string): Promise<Buffer> {
  return readFile(localObjectPath(root, storageKey));
}

export async function deleteLocalObject(root: string, storageKey: string): Promise<void> {
  await rm(localObjectPath(root, storageKey), { force: true });
}
