**CortexDocs AI**
=================

![1771238209638](images/README/logo.png)

CortexDocs AI is a full-stack AI-powered desktop document workspace that allows users to upload, organize, preview, edit, annotate, and chat with project-scoped documents. Built on a Retrieval-Augmented Generation (RAG) architecture, the system extracts document content, segments it into chunks, generates vector embeddings, and performs similarity-based retrieval so copilot responses stay grounded in the documents inside the active project.

The platform integrates local authentication, project management, document storage, document conversion, semantic search, editing tools, and conversational AI into a single desktop workflow. Uploaded files are normalized into three supported categories: images are stored as JPG files, Word documents are converted into PDF files, and text-like files are stored as TXT files. Users can annotate PDFs and images, edit text documents, save changes, and automatically refresh document chunks and embeddings after edits.

CortexDocs AI is designed for university students, professionals, and internal teams who frequently work with reports, technical documentation, lecture materials, policies, diagrams, or assessment resources. It turns static project folders into an interactive knowledge system where each project has its own document list, preview/editor surface, and project-specific copilot.

**Tech Stack**
--------------


| Layer    | Technology / Tools                                             |
| -------- | -------------------------------------------------------------- |
| Desktop  | Tauri, React (Vite), Tailwind CSS, React Router                |
| Backend  | Node.js (Express), Cloudflare R2-compatible S3 storage         |
| Database | PostgreSQL with pgvector                                       |
| AI Layer | Configurable embeddings and LLM providers, Groq Llama 3.1      |

**Prerequisites**
-----------------

Ensure the following software is installed:

- Node.js (v18 or higher)
- npm (comes with Node)
- Docker and Docker Compose
- Rust and Cargo, required by Tauri desktop development
- A Cloudflare R2 bucket and access keys
- A Groq API key for the default LLM provider
- LibreOffice, required for DOC/DOCX to PDF conversion with formatting preservation

**Database and Environment Setup (Required Before Running the App)**
--------------------------------------------------------------------

CortexDocs AI uses PostgreSQL for application data and vector search, Cloudflare R2 for document file storage, and local backend authentication for user sessions.

**1\. Start PostgreSQL**

1. Ensure Docker is running
2. From the project root, run `docker compose up -d postgres`
3. PostgreSQL will start with the schema mounted from `/database/schema.postgres.sql`

**2\. Configure Cloudflare R2**

1. Create a Cloudflare R2 bucket
2. Create R2 API tokens with read/write access
3. Copy the bucket name, endpoint, access key, and secret key
4. Add them to `backend/.env`

**3\. Configure AI Providers**

1. Create a Groq API key
2. Add it to `backend/.env`
3. Optional model settings are configured through the backend model registry

**4\. Create Desktop Env**

Create apps/desktop/.env:

```
VITE_BACKEND_URL=http://localhost:8080
```

**5\. Create Backend Env**

Create backend/.env:

```
PORT=8080
DATABASE_URL=postgres://cortex:cortex@postgres:5432/cortexdocs
AUTH_SECRET=replace_with_a_long_random_secret

R2_BUCKET=your_r2_bucket
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key

GROQ_API_KEY=your_llm_key
LIBREOFFICE_BIN=soffice
```

Note 1: When running the backend with Docker, `DATABASE_URL` is supplied by `docker-compose.yml`. For local backend runs outside Docker, use `postgres://cortex:cortex@localhost:5432/cortexdocs`.

Note 2: DOC/DOCX files are converted to PDF with LibreOffice. In Docker, LibreOffice is installed by the backend image. For local backend runs on macOS, install LibreOffice and set `LIBREOFFICE_BIN=/Applications/LibreOffice.app/Contents/MacOS/soffice`.

**Local Deployment (Without Docker)**
-------------------------------------

Run the below commands:

```
cd apps/desktop
npm install
npm run dev
```

Then run the below commands in a separate terminal:

```
cd backend
npm install
npm run dev
```

Then run the desktop app in another terminal:

```
cd apps/desktop
npm run desktop:dev
```

The Vite desktop renderer runs at http://localhost:5173, while the backend runs at http://localhost:8080.

**Docker Deployment**
---------------------

Ensure Docker is installed, then from the project root:

```
docker compose up --build
```

The application will be available at:

* Desktop renderer: http://localhost:5173
* Backend: http://localhost:8080
