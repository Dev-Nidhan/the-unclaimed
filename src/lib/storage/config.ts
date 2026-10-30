export type StorageMode = "spaces" | "local";

export type SpacesSettings = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type StorageConfig = {
  mode: StorageMode;
  localRoot: string;
  urlTtlSeconds: number;
  spaces: SpacesSettings | null;
};

function ttlSeconds(): number {
  const raw = Number(process.env.SPACES_URL_TTL_SECONDS);
  if (!Number.isInteger(raw)) {
    return 900;
  }
  return Math.min(3600, Math.max(60, raw));
}

function spacesSettings(): SpacesSettings | null {
  const endpoint = process.env.SPACES_ENDPOINT?.trim() ?? "";
  const bucket = process.env.SPACES_BUCKET?.trim() ?? "";
  const accessKeyId = process.env.SPACES_ACCESS_KEY?.trim() ?? "";
  const secretAccessKey = process.env.SPACES_SECRET_KEY?.trim() ?? "";
  const region = process.env.SPACES_REGION?.trim() ?? "";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const regional = host.endsWith(".digitaloceanspaces.com") && host !== "digitaloceanspaces.com";
  if (url.protocol !== "https:" || !regional) {
    return null;
  }
  if (region && region !== "us-east-1" && host !== `${region.toLowerCase()}.digitaloceanspaces.com`) {
    return null;
  }
  return { endpoint: url.origin, bucket, accessKeyId, secretAccessKey };
}

export function readStorageConfig(localRoot = ""): StorageConfig {
  const spaces = spacesSettings();
  return {
    mode: spaces ? "spaces" : "local",
    localRoot,
    urlTtlSeconds: ttlSeconds(),
    spaces,
  };
}
