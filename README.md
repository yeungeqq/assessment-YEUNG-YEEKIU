**CortexDocs AI**
=================

CortexDocs AI is a full-stack AI-powered document intelligence web application that allows users to upload PDF and DOCX documents and interact with them through a conversational interface. Built on a Retrieval-Augmented Generation (RAG) architecture, the system extracts document text, segments it into semantic chunks, generates vector embeddings, and performs similarity-based retrieval to ensure that every response is grounded strictly in user-uploaded content.

The platform integrates secure authentication, document management, semantic search, and conversational AI into a single streamlined workflow. Users can upload individual files or bulk ZIP archives, manage stored documents, and ask contextual follow-up questions within a persistent chat interface. By combining vector search with controlled LLM prompting, CortexDocs AI minimizes hallucination and delivers accurate, document-backed answers.

CortexDocs AI is designed for university students, professionals, and internal teams who frequently work with long reports, technical documentation, policies, or assessment materials. It transforms static documents into an interactive knowledge system, significantly reducing the time required to locate and understand critical information.

**Run Locally (Without Docker)**
--------------------------------

### **Backend**

Create backend/.env:

```
PORT=8080
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_llm_key
HUGGINGFACEHUB_API_TOKEN=your_embedding_key
```

```
cd backend
npm install
npm run dev
```

Backend runs at http://localhost:8080

### **Frontend**

Create frontend/.env:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://localhost:8080
```

```
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

**Run with Docker**
-------------------

Create frontend and backend .env as above. Ensure Docker is installed, then from the project root:

```
docker compose up --build
```

The application will be available at:

* Frontend: http://localhost:5173
* Backend: http://localhost:8080
