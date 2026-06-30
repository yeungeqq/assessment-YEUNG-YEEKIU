import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2_BUCKET, r2Client } from "../config/r2.js";

function requireBucket() {
  if (!R2_BUCKET) throw new Error("R2_BUCKET is not configured");
  return R2_BUCKET;
}

export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType: string | null;
}) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: requireBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType || undefined,
    })
  );
}

export async function deleteObject(key: string) {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: requireBucket(),
      Key: key,
    })
  );
}

export async function downloadObjectBuffer(key: string) {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: requireBucket(),
      Key: key,
    })
  );

  if (!response.Body) throw new Error("R2 object has no body");
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function createObjectDownloadUrl(key: string, expiresIn = 60) {
  return getSignedUrl(
    r2Client,
    new GetObjectCommand({
      Bucket: requireBucket(),
      Key: key,
    }),
    { expiresIn }
  );
}
