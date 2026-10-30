import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SpacesSettings } from "./config";

export function createSpacesClient(settings: SpacesSettings): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: "us-east-1",
    forcePathStyle: false,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}

export async function putSpacesObject(
  client: S3Client,
  bucket: string,
  storageKey: string,
  bytes: Buffer,
  mimeType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: bytes,
      ContentType: mimeType,
      ACL: "private",
    }),
  );
}

export async function deleteSpacesObject(client: S3Client, bucket: string, storageKey: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );
}

export async function presignSpacesDownload(
  client: S3Client,
  bucket: string,
  storageKey: string,
  filename: string,
  expiresIn: number,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
  });
  return getSignedUrl(client, command, { expiresIn });
}
