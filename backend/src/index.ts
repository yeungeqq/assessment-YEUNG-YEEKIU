import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "./middleware/requireUser.js";
import { chunkText } from "./rag/chunk.js";
import { extractTextFromFile } from "./rag/extract.js";
import { embedBatch, embedText } from "./rag/embeddings.js";
import { answerWithSources } from "./rag/llm.js";

type MatchRow = {
  content: string;
  document_id: string;
  chunk_index: number;
  similarity: number;
};

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.options("*", cors());
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.PORT || 8080);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.warn(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set backend/.env before running."
  );
}

export const supabaseAdmin = createClient(
  SUPABASE_URL || "http://localhost:54321",
  SERVICE_ROLE || "missing-service-role-key"
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend", time: new Date().toISOString() });
});

/**
 * POST /chat
 * Body: { message: string }
 * Returns: { answer: string, citations: Array<...> }
 */
app.post("/chat", requireUser, async (req, res) => {
  const schema = z.object({
    message: z.string().min(1).max(4000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const question = parsed.data.message;

  try {
    // 1) embed query
    const queryEmbedding = await embedText(question);

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 768) {
      return res.status(500).json({ error: `Bad embedding dim: ${queryEmbedding?.length}` });
    }

    // 2) retrieve top chunks (RPC)
    const { data: matches, error: matchErr } = await supabaseAdmin.rpc("match_chunks_json", {
      match_count: 6,
      query_embedding: queryEmbedding, // raw JS array => json in postgres func
    });

    if (matchErr) {
      console.error("match_chunks_json error:", matchErr);
      return res.status(500).json({ error: `Vector search failed: ${matchErr.message}` });
    }

    const rows = (Array.isArray(matches) ? (matches as MatchRow[]) : []) ?? [];

    // If no matches, return graceful response (no fake hallucinations)
    if (rows.length === 0) {
      return res.json({
        answer: "I couldn't find relevant information in the uploaded documents.",
        citations: [],
      });
    }

    // 3) fetch doc titles for citations
    const docIds = [...new Set(rows.map((r) => r.document_id))];
    const { data: docs, error: docsErr } = await supabaseAdmin
      .from("documents")
      .select("id,title")
      .in("id", docIds);

    if (docsErr) console.warn("Could not fetch doc titles:", docsErr.message);

    const titleById = new Map<string, string>(
      (docs ?? []).map((d: any) => [d.id, d.title ?? "Untitled"])
    );

    // 4) Build context sources (increase a bit; 800 can be too short)
    const sources = rows
      .slice(0, 6)
      .map((m, i) => `Source [S${i + 1}]\n${(m.content ?? "").slice(0, 1400)}`);

    // 5) Ask LLM
    const answer = await answerWithSources(question, sources);

    // 6) Return citations
    const citations = rows.map((m, i) => ({
      label: `S${i + 1}`,
      documentId: m.document_id,
      documentTitle: titleById.get(m.document_id) ?? "Untitled",
      chunkIndex: m.chunk_index,
      similarity: m.similarity,
      snippet: (m.content ?? "").slice(0, 260) + "...",
    }));

    return res.json({ answer, citations });
  } catch (e: any) {
    console.error("CHAT ERROR:", e);
    return res.status(500).json({ error: e?.message ?? "Chat failed" });
  }
});

/**
 * POST /documents/ingest
 * Body: { documentId: string }
 */
app.post("/documents/ingest", requireUser, async (req, res) => {
  const schema = z.object({ documentId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { documentId } = parsed.data;
  const userId = req.userId!;

  try {
    // 1) fetch document + ownership
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docErr || !doc) return res.status(404).json({ error: "Document not found or not owned by user" });

    // 2) signed URL to download
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);

    if (signErr || !signed?.signedUrl) return res.status(500).json({ error: "Failed to create signed URL" });

    // 3) download bytes
    const fileResp = await fetch(signed.signedUrl);
    if (!fileResp.ok) return res.status(500).json({ error: "Failed to download file from storage" });

    const buffer = Buffer.from(await fileResp.arrayBuffer());

    // 4) extract text
    const mimeType = doc.mime_type || "application/pdf";
    const text = await extractTextFromFile(buffer, mimeType);
    if (!text.trim()) return res.status(400).json({ error: "No extractable text found (maybe scanned PDF?)" });

    // 5) chunk
    const chunks = chunkText(text, 1200, 200).slice(0, 80);

    // 6) embed in batches
    const BATCH = 16;
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embs = await embedBatch(batch);
      vectors.push(...embs);
    }

    // 7) replace previous chunks (re-ingest safe)
    await supabaseAdmin.from("document_chunks").delete().eq("document_id", documentId);

    const rows = chunks.map((content: string, idx: number) => ({
      document_id: documentId,
      content,
      chunk_index: idx,
      embedding: vectors[idx],
    }));

    const { error: insErr } = await supabaseAdmin.from("document_chunks").insert(rows);
    if (insErr) return res.status(500).json({ error: `Insert chunks failed: ${insErr.message}` });

    return res.json({ ok: true, chunks: rows.length });
  } catch (e: any) {
    console.error("INGEST ERROR:", e);
    return res.status(500).json({ error: e?.message ?? "Ingest failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});