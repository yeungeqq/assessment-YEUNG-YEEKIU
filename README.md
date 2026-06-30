**CortexDocs AI**
=================

CortexDocs AI is a desktop document intelligence app for organizing documents into projects and asking a project-scoped copilot questions grounded in uploaded files.

The current app is built as:

| Layer | Technology / Tools |
| --- | --- |
| Desktop UI | Tauri, React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL with pgvector |
| AI Layer | Embeddings + LLM providers configured from `backend/.env` |
| Storage | Cloudflare R2 for uploaded document files |

**Project Structure**
---------------------

```txt
apps/desktop/        Tauri + React desktop app
backend/             Express API, RAG, auth, PostgreSQL repositories
database/            PostgreSQL schema and migrations
docker-compose.yml   PostgreSQL + backend services
```

**Prerequisites**
-----------------

- Node.js 18+
- npm
- Docker
- Rust/Cargo for Tauri desktop development

Install Rust if needed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --no-modify-path
source "$HOME/.cargo/env"
```

**Environment**
---------------

Create `backend/.env`:

```bash
PORT=8080
DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortexdocs
AUTH_SECRET=change_this_for_local_tokens
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=cortexdocs-documents
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
EMBED_MODEL_API_TOKEN=your_embedding_key
EMBED_MODEL=BAAI/bge-base-en-v1.5
GROQ_API_KEY=your_llm_key
GROQ_MODEL=llama-3.1-8b-instant
```

Create `apps/desktop/.env`:

```bash
VITE_BACKEND_URL=http://localhost:8080
```

Local app login/signup uses PostgreSQL-backed auth. Uploaded document files are stored in Cloudflare R2.

**Run Locally**
---------------

Start PostgreSQL and backend:

```bash
docker compose up --build
```

In another terminal, start the desktop app:

```bash
npm install
npm --prefix apps/desktop install
npm run desktop:dev
```

Useful checks:

```bash
curl http://localhost:8080/health
npm run desktop:web-build
cd backend && npm run build
```
