import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";

export const R2_BUCKET = process.env.R2_BUCKET;
export const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

if (!R2_BUCKET || !R2_ENDPOINT) {
  console.warn(
    "Missing R2_BUCKET or R2_ENDPOINT/R2_ACCOUNT_ID. Set backend/.env before uploading documents."
  );
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});
