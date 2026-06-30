import { Router } from "express";
import express from "express";
import { z } from "zod";
import { requireUser } from "../middleware/requireUser.js";
import { extractTextFromFile } from "../rag/extract.js";
import {
  deleteChunksByDocumentId,
  insertDocumentChunks,
} from "../repositories/documentChunkRepository.js";
import {
  createDocumentRecord,
  deleteDocumentByIdAndUser,
  findDocumentByIdAndUser,
  findDocumentByIdUserAndProject,
  listDocumentsByUser,
  updateDocumentFilePath,
} from "../repositories/documentRepository.js";
import {
  INGEST_REQUEST_SCHEMA,
  buildChunks,
  embedChunks,
  isSupportedDocumentMimeType,
} from "../services/documentIngestService.js";
import {
  createObjectDownloadUrl,
  deleteObject,
  downloadObjectBuffer,
  uploadObject,
} from "../services/storageService.js";

export const documentsRouter = Router();

const UPLOAD_DOCUMENT_QUERY_SCHEMA = z.object({
  projectId: z.string().uuid().nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  mimeType: z.string().nullable().optional(),
});

documentsRouter.get("/documents", requireUser, async (req, res) => {
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined;

  try {
    const documents = await listDocumentsByUser(req.userId!, projectId);
    return res.json({ data: documents });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to load documents" });
  }
});

documentsRouter.post(
  "/documents/upload",
  requireUser,
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req, res) => {
    const parsed = UPLOAD_DOCUMENT_QUERY_SCHEMA.safeParse({
      projectId:
        typeof req.query.projectId === "string" ? req.query.projectId : undefined,
      folderId:
        typeof req.query.folderId === "string" ? req.query.folderId : undefined,
      title: typeof req.query.title === "string" ? req.query.title : undefined,
      mimeType:
        typeof req.query.mimeType === "string" ? req.query.mimeType : undefined,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "Missing document file body" });
    }

    let createdDocumentId: string | null = null;

    try {
      const document = await createDocumentRecord({
        userId: req.userId!,
        projectId: parsed.data.projectId ?? null,
        folderId: parsed.data.folderId ?? null,
        title: parsed.data.title,
        filePath: "pending",
        mimeType: parsed.data.mimeType ?? null,
      });
      createdDocumentId = document.id;

      const projectSegment = parsed.data.projectId
        ? `projects/${parsed.data.projectId}`
        : "global";
      const safeName = parsed.data.title.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const objectKey = `${req.userId}/${projectSegment}/${document.id}/${safeName}`;

      await uploadObject({
        key: objectKey,
        body: req.body,
        contentType: parsed.data.mimeType ?? null,
      });

      await updateDocumentFilePath(document.id, req.userId!, objectKey);

      return res.status(201).json({
        data: {
          id: document.id,
          file_path: objectKey,
        },
      });
    } catch (e: any) {
      if (createdDocumentId) {
        await deleteDocumentByIdAndUser(createdDocumentId, req.userId!).catch(() => null);
      }
      return res.status(500).json({ error: e?.message ?? "Failed to upload document" });
    }
  }
);

documentsRouter.delete("/documents/:documentId", requireUser, async (req, res) => {
  try {
    const { document } = await findDocumentByIdAndUser(
      req.params.documentId,
      req.userId!
    );
    if (!document) return res.status(404).json({ error: "Document not found" });

    await deleteObject(document.file_path);
    const deleted = await deleteDocumentByIdAndUser(
      req.params.documentId,
      req.userId!
    );
    if (!deleted) return res.status(404).json({ error: "Document not found" });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to delete document" });
  }
});

documentsRouter.get("/documents/:documentId/download-url", requireUser, async (req, res) => {
  try {
    const { document } = await findDocumentByIdAndUser(
      req.params.documentId,
      req.userId!
    );
    if (!document) return res.status(404).json({ error: "Document not found" });

    const signedUrl = await createObjectDownloadUrl(document.file_path, 60);
    return res.json({ data: { signedUrl } });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to create download URL" });
  }
});

documentsRouter.post("/documents/ingest", requireUser, async (req, res) => {
  const parsed = INGEST_REQUEST_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { documentId, projectId } = parsed.data;
  const userId = req.userId!;

  try {
    const { document: doc, error: docErr } = projectId
      ? await findDocumentByIdUserAndProject(documentId, userId, projectId)
      : await findDocumentByIdAndUser(documentId, userId);

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

    const buffer = await downloadObjectBuffer(doc.file_path);

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
