# Executable Architecture — React (Frontend) + Node.js (Backend) + Supabase

This is a starter scaffold for a full-stack app using:
- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + TypeScript (Express)
- **Auth/DB/Storage:** Supabase (hosted)

> Note: This repo assumes you've already created your Supabase project.

---

## 1) Prerequisites
- Node.js 18+ (recommended 20+)
- npm (or pnpm/yarn)

---

## 2) Environment Variables

### Frontend (`frontend/.env`)
Create `frontend/.env`:
```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_BACKEND_URL=http://localhost:8080
```

### Backend (`backend/.env`)
Create `backend/.env`:
```
PORT=8080
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
# Optional: provider keys (e.g., OpenAI) for LLM calls
OPENAI_API_KEY=
```

---

## 3) Run locally (dev)

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## 4) What’s included

### Frontend
- Supabase Auth (email/password)
- Protected routes
- Pages:
  - Login / Signup
  - Chat (UI scaffold)
  - Upload Documents (UI scaffold)

### Backend
- JWT verification via Supabase Admin (`SUPABASE_SERVICE_ROLE_KEY`)
- Endpoints:
  - `GET /health`
  - `POST /chat` (stub: where you’ll implement RAG + LLM)
  - `POST /documents/ingest` (stub: where you’ll implement extraction/chunking/embedding)

---

## 5) Next steps (for RAG)
- Enable `pgvector` in Supabase (SQL editor):
```sql
create extension if not exists vector;
```
- Create tables: `documents`, `document_chunks`, `chats`, `messages`
- Implement:
  - `/documents/ingest` → fetch from Supabase Storage, extract text, chunk, embed, store vectors
  - `/chat` → embed query, vector search, build prompt, call LLM, return answer + citations

---

## 6) Docker (optional)
Dockerfiles are included for both services.
