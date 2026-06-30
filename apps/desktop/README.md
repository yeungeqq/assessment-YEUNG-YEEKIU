# CortexDocs AI Desktop

This is the Tauri desktop shell for CortexDocs AI. It reuses the current React UI and points at the local backend.

## Prerequisites

- Node.js
- Rust and Cargo
- Tauri system dependencies for your OS
- Backend running on `http://localhost:8080`
- PostgreSQL/pgvector running through the root `docker-compose.yml`

## Environment

Create `apps/desktop/.env`:

```bash
VITE_BACKEND_URL=http://localhost:8080
```

## Commands

```bash
npm --prefix apps/desktop run build
npm --prefix apps/desktop run desktop:dev
npm --prefix apps/desktop run desktop:build
```

From the repo root, you can also run:

```bash
npm run desktop:web-build
npm run desktop:dev
npm run desktop:build
```

The backend is still separate in this step. Document files are stored in Cloudflare R2 through backend upload/download endpoints.
