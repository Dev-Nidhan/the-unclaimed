export const artifactKinds = ["screenshot", "pdf", "archive_page", "report", "attachment"] as const;
export type ArtifactKind = (typeof artifactKinds)[number];

const mimeByKind: Record<ArtifactKind, readonly string[]> = {
  screenshot: ["image/png", "image/jpeg", "image/webp"],
  pdf: ["application/pdf"],
  archive_page: ["text/html", "application/xhtml+xml"],
  report: ["application/pdf", "text/html", "text/plain"],
  attachment: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/html", "text/plain"],
};

const extensionByMime: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/html": "html",
  "application/xhtml+xml": "html",
  "text/plain": "txt",
};

export const maxArtifactBytes = 20 * 1024 * 1024;

export function assertArtifactFile(input: { kind: string; mimeType: string; filename: string; byteLength: number }): {
  kind: ArtifactKind;
  mimeType: string;
  filename: string;
} {
  if (!artifactKinds.includes(input.kind as ArtifactKind)) {
    throw new Error("Choose a screenshot, PDF, archived page, report, or attachment.");
  }
  const kind = input.kind as ArtifactKind;
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!mimeByKind[kind].includes(mimeType)) {
    throw new Error("That file type is not allowed for this artifact.");
  }
  if (!Number.isInteger(input.byteLength) || input.byteLength < 1 || input.byteLength > maxArtifactBytes) {
    throw new Error("The file must be between 1 byte and 20 MB.");
  }
  const extension = extensionByMime[mimeType];
  const base = input.filename.split(/[/\\]/).pop()?.trim() ?? "";
  const stem = base.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (!stem || !extension) {
    throw new Error("The file needs a name.");
  }
  return { kind, mimeType, filename: `${stem}.${extension}` };
}

export function storageKeyFor(input: {
  investigationId: string;
  sourceId: string;
  artifactId: string;
  filename: string;
  local: boolean;
}): string {
  const body = `investigations/${input.investigationId}/sources/${input.sourceId}/${input.artifactId}/${input.filename}`;
  if (body.includes("..")) {
    throw new Error("The storage key is not valid.");
  }
  return input.local ? `local/${body}` : body;
}

export function isLocalStorageKey(storageKey: string): boolean {
  return storageKey.startsWith("local/") && !storageKey.includes("..");
}
