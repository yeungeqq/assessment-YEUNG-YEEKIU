import { extractTextFromFile } from "../rag/extract.js";
import {
  deleteChunksByDocumentId,
  insertDocumentChunks,
} from "../repositories/documentChunkRepository.js";
import {
  buildChunks,
  embedChunks,
  isSupportedDocumentMimeType,
} from "./documentIngestService.js";
import { downloadObjectBuffer, uploadObject } from "./storageService.js";

type RefreshDocumentContextParams = {
  documentId: string;
  filePath: string;
  mimeType: string | null;
  additionalText?: string;
};

export async function refreshDocumentContext({
  documentId,
  filePath,
  mimeType,
  additionalText,
}: RefreshDocumentContextParams) {
  if (!mimeType || mimeType === "application/zip") {
    throw new Error(
      "ZIP files are not supported for ingestion. Extract them before uploading."
    );
  }

  if (!isSupportedDocumentMimeType(mimeType)) {
    throw new Error("Unsupported document type.");
  }

  const buffer = await downloadObjectBuffer(filePath);
  const extractedText = await extractTextFromFile(buffer, mimeType);
  const text = [extractedText, additionalText].filter(Boolean).join("\n\n");

  if (!text.trim()) {
    throw new Error("No extractable text found.");
  }

  const chunks = buildChunks(text);
  const vectors = await embedChunks(chunks);

  await deleteChunksByDocumentId(documentId);

  const rows = chunks.map((content, idx) => ({
    document_id: documentId,
    content,
    chunk_index: idx,
    embedding: vectors[idx],
  }));

  const { error } = await insertDocumentChunks(rows);
  if (error) {
    throw new Error(`Insert chunks failed: ${error.message}`);
  }

  return { chunks: rows.length };
}

export async function replaceDocumentFileAndRefresh(params: {
  documentId: string;
  filePath: string;
  mimeType: string | null;
  body: Buffer;
}) {
  await uploadObject({
    key: params.filePath,
    body: params.body,
    contentType: params.mimeType,
  });

  if (!params.mimeType || !isSupportedDocumentMimeType(params.mimeType)) {
    await deleteChunksByDocumentId(params.documentId);
    return { chunks: 0 };
  }

  return refreshDocumentContext({
    documentId: params.documentId,
    filePath: params.filePath,
    mimeType: params.mimeType,
  });
}
