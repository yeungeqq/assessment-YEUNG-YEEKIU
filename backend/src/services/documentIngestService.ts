import { z } from "zod";
import { chunkText } from "../rag/chunk.js";
import { embedBatch } from "../rag/embeddings.js";

export const INGEST_REQUEST_SCHEMA = z.object({
  documentId: z.string().uuid(),
});

const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS = 80;
const EMBEDDING_BATCH_SIZE = 16;

export function isSupportedDocumentMimeType(
  mimeType: string | null | undefined
): mimeType is string {
  return Boolean(mimeType && SUPPORTED_DOCUMENT_MIME_TYPES.has(mimeType));
}

export async function downloadFileBuffer(url: string) {
  const fileResp = await fetch(url);
  if (!fileResp.ok) {
    throw new Error("Failed to download file from storage");
  }
  return Buffer.from(await fileResp.arrayBuffer());
}

export async function embedChunks(chunks: string[]) {
  const vectors: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const embs = await embedBatch(batch);
    vectors.push(...embs);
  }
  return vectors;
}

export function buildChunks(text: string) {
  return chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP).slice(0, MAX_CHUNKS);
}
