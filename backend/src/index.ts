import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './middleware/requireUser.js';

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

  res.json({
    ok: true,
    message: 'Stub ingest endpoint. Implement extraction/chunking/embeddings.',
    documentId: parsed.data.documentId,
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
