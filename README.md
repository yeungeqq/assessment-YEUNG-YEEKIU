**CortexDocs AI**
=================

CortexDocs AI is a full-stack AI-powered document intelligence web application that allows users to upload PDF and DOCX documents and interact with them through a conversational interface. Built on a Retrieval-Augmented Generation (RAG) architecture, the system extracts document text, segments it into semantic chunks, generates vector embeddings, and performs similarity-based retrieval to ensure that every response is grounded strictly in user-uploaded content.

The platform integrates secure authentication, document management, semantic search, and conversational AI into a single streamlined workflow. Users can upload individual files or bulk ZIP archives, manage stored documents, and ask contextual follow-up questions within a persistent chat interface. By combining vector search with controlled LLM prompting, CortexDocs AI minimizes hallucination and delivers accurate, document-backed answers.

CortexDocs AI is designed for university students, professionals, and internal teams who frequently work with long reports, technical documentation, policies, or assessment materials. It transforms static documents into an interactive knowledge system, significantly reducing the time required to locate and understand critical information.

For more details of CortexDocs AI, please visit /docs/prd.md to view the Production Requirements Document (PRD).

**Local Deployment (Without Docker)**
-------------------------------------

### **Create Backend Env**

Create backend/.env:

```
PORT=8080
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
HUGGINGFACEHUB_API_TOKEN=your_embedding_key
HF_EMBED_MODEL=BAAI/bge-base-en-v1.5
GROQ_API_KEY=your_llm_key
GROQ_MODEL=llama-3.1-8b-instant
```

Then run the below commands:

```
cd backend
npm install
npm run dev
```

Backend runs at http://localhost:8080

### **Create Frontend Env**

Create frontend/.env:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://localhost:8080
```

Then run the below commands:

```
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

**Docker Deployment**
---------------------

Create frontend and backend .env as above. Ensure Docker is installed, then from the project root:

```
docker compose up --build
```

The application will be available at:

* Frontend: http://localhost:5173
* Backend: http://localhost:8080
