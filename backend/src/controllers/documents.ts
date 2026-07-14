import { Router } from "express";
import express from "express";
import { z } from "zod";
import { requireUser } from "../middleware/requireUser.js";
import { extractTextFromFile } from "../rag/extract.js";
import {
  getDocumentAnnotations,
  upsertDocumentAnnotations,
} from "../repositories/documentAnnotationRepository.js";
import { deleteChunksByDocumentId } from "../repositories/documentChunkRepository.js";
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
  isSupportedDocumentMimeType,
} from "../services/documentIngestService.js";
import { normalizeDocumentUpload } from "../services/documentConversionService.js";
import {
  refreshDocumentContext,
  replaceDocumentFileAndRefresh,
} from "../services/documentRefreshService.js";
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

const DOCUMENT_ANNOTATIONS_SCHEMA = z.object({
  annotations: z.array(z.unknown()),
});

function annotationsToSearchableText(annotations: unknown[]) {
  const textAnnotations = annotations
    .filter((annotation): annotation is { type: string; text?: unknown; page?: unknown } => {
      return (
        Boolean(annotation) &&
        typeof annotation === "object" &&
        (annotation as { type?: unknown }).type === "text" &&
        typeof (annotation as { text?: unknown }).text === "string" &&
        (annotation as { text?: string }).text!.trim().length > 0
      );
    });

  if (textAnnotations.length === 0) return "";

  return [
    "User-added document annotations:",
    ...textAnnotations.map((annotation, index) => {
      const text = typeof annotation.text === "string" ? annotation.text.trim() : "";
      const page =
        typeof annotation.page === "number" && Number.isFinite(annotation.page)
          ? ` on page ${annotation.page}`
          : "";
      return `Text box ${index + 1}${page}: ${text}`;
    }),
  ].join("\n");
}

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
      const normalizedUpload = await normalizeDocumentUpload({
        body: req.body,
        title: parsed.data.title,
        mimeType: parsed.data.mimeType ?? null,
      });

      const document = await createDocumentRecord({
        userId: req.userId!,
        projectId: parsed.data.projectId ?? null,
        folderId: parsed.data.folderId ?? null,
        title: normalizedUpload.title,
        filePath: "pending",
        mimeType: normalizedUpload.mimeType,
      });
      createdDocumentId = document.id;

      const projectSegment = parsed.data.projectId
        ? `projects/${parsed.data.projectId}`
        : "global";
      const safeName = normalizedUpload.title.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const objectKey = `${req.userId}/${projectSegment}/${document.id}/${safeName}`;

      await uploadObject({
        key: objectKey,
        body: normalizedUpload.body,
        contentType: normalizedUpload.mimeType,
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

    await deleteChunksByDocumentId(req.params.documentId);
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

documentsRouter.get("/documents/:documentId/file", requireUser, async (req, res) => {
  try {
    const { document } = await findDocumentByIdAndUser(
      req.params.documentId,
      req.userId!
    );
    if (!document) return res.status(404).json({ error: "Document not found" });

    const buffer = await downloadObjectBuffer(document.file_path);
    if (document.mime_type) {
      res.setHeader("Content-Type", document.mime_type);
    }
    res.setHeader("Content-Disposition", `inline; filename="${document.title ?? "document"}"`);
    return res.send(buffer);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to load document" });
  }
});

documentsRouter.get("/documents/:documentId/annotations", requireUser, async (req, res) => {
  try {
    const { document } = await findDocumentByIdAndUser(
      req.params.documentId,
      req.userId!
    );
    if (!document) return res.status(404).json({ error: "Document not found" });

    const annotations = await getDocumentAnnotations(
      req.params.documentId,
      req.userId!
    );
    return res.json({ data: { annotations } });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to load annotations" });
  }
});

documentsRouter.put("/documents/:documentId/annotations", requireUser, async (req, res) => {
  const parsed = DOCUMENT_ANNOTATIONS_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const { document } = await findDocumentByIdAndUser(
      req.params.documentId,
      req.userId!
    );
    if (!document) return res.status(404).json({ error: "Document not found" });

    const annotations = await upsertDocumentAnnotations({
      documentId: req.params.documentId,
      userId: req.userId!,
      annotations: parsed.data.annotations,
    });

    let chunks = 0;
    if (document.mime_type && isSupportedDocumentMimeType(document.mime_type)) {
      const result = await refreshDocumentContext({
        documentId: document.id,
        filePath: document.file_path,
        mimeType: document.mime_type,
        additionalText: annotationsToSearchableText(parsed.data.annotations),
      });
      chunks = result.chunks;
    }

    return res.json({ data: { annotations, chunks } });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to save annotations" });
  }
});

documentsRouter.get("/documents/:documentId/text-preview", requireUser, async (req, res) => {
  try {
    const { document } = await findDocumentByIdAndUser(
      req.params.documentId,
      req.userId!
    );
    if (!document) return res.status(404).json({ error: "Document not found" });

    if (!document.mime_type || !isSupportedDocumentMimeType(document.mime_type)) {
      return res.status(400).json({ error: "Text preview is not available." });
    }

    const buffer = await downloadObjectBuffer(document.file_path);
    const text = await extractTextFromFile(buffer, document.mime_type);
    return res.json({ data: { text } });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: e?.message ?? "Failed to create text preview" });
  }
});

documentsRouter.put(
  "/documents/:documentId/file",
  requireUser,
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "Missing document file body" });
    }

    try {
      const { document } = await findDocumentByIdAndUser(
        req.params.documentId,
        req.userId!
      );
      if (!document) return res.status(404).json({ error: "Document not found" });

      const result = await replaceDocumentFileAndRefresh({
        documentId: document.id,
        filePath: document.file_path,
        mimeType: document.mime_type,
        body: req.body,
      });

      return res.json({ ok: true, chunks: result.chunks });
    } catch (e: any) {
      console.error("DOCUMENT SAVE ERROR:", e);
      return res.status(500).json({ error: e?.message ?? "Failed to save document" });
    }
  }
);

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

    try {
      const result = await refreshDocumentContext({
        documentId,
        filePath: doc.file_path,
        mimeType: doc.mime_type,
      });

      return res.json({ ok: true, chunks: result.chunks });
    } catch (err) {
      console.error("Extraction failed:", err);
      return res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Failed to extract document. File may be corrupted.",
      });
    }
  } catch (e: any) {
    console.error("INGEST ERROR:", e);
    return res.status(500).json({ error: e?.message ?? "Ingest failed" });
  }
});
