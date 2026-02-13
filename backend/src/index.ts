import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './middleware/requireUser.js';
import { chunkText } from "./rag/chunk.js";
import { extractTextFromFile } from "./rag/extract.js";
import { embedTexts } from "./rag/embeddings.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 8080);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set backend/.env before running.');
}

export const supabaseAdmin = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SERVICE_ROLE || 'missing-service-role-key'
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

/**
 * POST /chat
 * Body: { chatId?: string, message: string }
 * Returns: { answer: string, citations: Array<{documentId:string, snippet:string}> }
 *
 * TODO: Implement RAG:
 * - embed query
 * - vector search relevant chunks
 * - call LLM with context
 * - return answer + citations
 */
app.post('/chat', requireUser, async (req, res) => {
  const schema = z.object({
    chatId: z.string().uuid().optional(),
    message: z.string().min(1).max(4000),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { message } = parsed.data;
  // Placeholder response:
  res.json({
    answer: `Stub response. You said: "${message}". Implement RAG + LLM here.`,
    citations: [],
  });
});

/**
 * POST /documents/ingest
 * Body: { documentId: string }
 *
 * TODO: Implement ingestion:
 * - fetch file from Supabase Storage
 * - extract text (pdf/docx)
 * - chunk text
 * - create embeddings
 * - insert into document_chunks
 */
app.post('/documents/ingest', requireUser, async (req, res) => {
  const schema = z.object({ documentId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const documentId = parsed.data.documentId;
  const userId = req.userId!;
  
  // 1) Fetch document row and validate ownership
  const { data: doc, error: docErr } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docErr || !doc) return res.status(404).json({ error: "Document not found or not owned by user" });

  // 2) Create a signed URL to download from storage
  const { data: signed, error: signErr } = await supabaseAdmin
    .storage
    .from("documents")
    .createSignedUrl(doc.file_path, 60);

  if (signErr || !signed?.signedUrl) return res.status(500).json({ error: "Failed to create signed URL" });

  // 3) Download the file
  const fileResp = await fetch(signed.signedUrl);
  if (!fileResp.ok) return res.status(500).json({ error: "Failed to download file from storage" });

  const arrayBuffer = await fileResp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 4) Detect MIME type (use DB if you stored it; else infer)
  const mimeType =
    doc.mime_type ||
    (doc.title?.toLowerCase().endsWith(".pdf") ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

  // 5) Extract text
  const text = await extractTextFromFile(buffer, mimeType);
  if (!text.trim()) return res.status(400).json({ error: "No extractable text found" });

  // 6) Chunk
  const chunks = chunkText(text, 1200, 200).slice(0, 80); // limit to avoid huge API costs
  // (You can tune this; 50–150 chunks is fine for demo)

  // 7) Embed in batches
  const BATCH = 16;
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vecs = await embedTexts(batch);
    embeddings.push(...vecs);
  }

  // 8) Insert into document_chunks
  const rows = chunks.map((content, idx) => ({
    document_id: documentId,
    content,
    chunk_index: idx,
    embedding: embeddings[idx],
  }));

  // Optional: clear previous chunks if re-ingesting
  await supabaseAdmin.from("document_chunks").delete().eq("document_id", documentId);

  const { error: insErr } = await supabaseAdmin.from("document_chunks").insert(rows);
  if (insErr) return res.status(500).json({ error: `Failed to insert chunks: ${insErr.message}` });

  res.json({ ok: true, chunks: rows.length });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
