import { Router } from "express";
import { requireUser } from "../middleware/requireUser.js";
import { extractTextFromFile } from "../rag/extract.js";
import {
  deleteChunksByDocumentId,
  insertDocumentChunks,
} from "../repositories/documentChunkRepository.js";
import {
  createDocumentSignedUrl,
  findDocumentByIdAndUser,
} from "../repositories/documentRepository.js";
import {
  INGEST_REQUEST_SCHEMA,
  buildChunks,
  downloadFileBuffer,
  embedChunks,
  isSupportedDocumentMimeType,
} from "../services/documentIngestService.js";

export const documentsRouter = Router();

documentsRouter.post("/documents/ingest", requireUser, async (req, res) => {
  const parsed = INGEST_REQUEST_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { documentId } = parsed.data;
  const userId = req.userId!;

  try {
    const { document: doc, error: docErr } = await findDocumentByIdAndUser(
      documentId,
      userId
    );

    if (docErr || !doc) {
      return res
        .status(404)
        .json({ error: "Document not found or not owned by user" });
    }

    if (!doc.mime_type || doc.mime_type === "application/zip") {
      return res.status(400).json({
        error:
          "ZIP files are not supported for ingestion. Extract them before uploading.",
      });
    }

    if (!isSupportedDocumentMimeType(doc.mime_type)) {
      return res.status(400).json({ error: "Unsupported document type." });
    }

    const { signedUrl, error: signedUrlError } = await createDocumentSignedUrl(
      doc.file_path
    );
    if (signedUrlError || !signedUrl) {
      return res.status(500).json({ error: "Failed to create signed URL" });
    }

    const buffer = await downloadFileBuffer(signedUrl);

    let text = "";
    try {
      text = await extractTextFromFile(buffer, doc.mime_type);
    } catch (err) {
      console.error("Extraction failed:", err);
      return res.status(400).json({
        error: "Failed to extract document. File may be corrupted.",
      });
    }

    if (!text.trim()) {
      return res
        .status(400)
        .json({ error: "No extractable text found (maybe scanned PDF?)" });
    }

    const chunks = buildChunks(text);
    const vectors = await embedChunks(chunks);

    await deleteChunksByDocumentId(documentId);

    const rows = chunks.map((content: string, idx: number) => ({
      document_id: documentId,
      content,
      chunk_index: idx,
      embedding: vectors[idx],
    }));

    const { error: insErr } = await insertDocumentChunks(rows);
    if (insErr) {
      return res
        .status(500)
        .json({ error: `Insert chunks failed: ${insErr.message}` });
    }

    return res.json({ ok: true, chunks: rows.length });
  } catch (e: any) {
    console.error("INGEST ERROR:", e);
    return res.status(500).json({ error: e?.message ?? "Ingest failed" });
  }
});
