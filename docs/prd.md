**CortexDocs AI – Product Requirements Document**
==================================================

![1771238606466](images/prd/1771238606466.png)

**1\. Product Overview**
------------------------

### **What is the product?**

**CortexDocs AI** is an AI-powered document intelligence web application that allows users to upload PDF, DOCX, and ZIP documents and interact with them through a conversational interface.

The system leverages **Retrieval-Augmented Generation (RAG)** to provide contextual, accurate, and precise answers grounded strictly in user-uploaded content.

### **What problem does it solve?**

Professionals and students frequently need to extract information from long documents such as reports, assessments, lecture notes, or technical documentation. Manually reading and locating relevant sections is time-consuming and inefficient.

CortexDocs AI solves this by:

* Converting documents into searchable semantic embeddings
* Performing vector-based retrieval
* Generating AI responses grounded in retrieved document chunks
* Providing an interactive chat interface for follow-up questions

**2\. Idea Derivation**
-----------------------

### Growing Reliance on AI Copilots

The idea originated from the increasing reliance on AI copilots for productivity tasks, combined with the observation that many AI tools hallucinate when answering document-based questions.

### Technical Insight and Validation

By combining LLMs with vector search, the system establishes a practical and scalable architecture for document intelligence. It integrates document chunking, embedding generation, vector similarity retrieval, and controlled answer generation into a unified pipeline. This structured approach enables accurate, context-aware responses while maintaining scalability and reliability, making it significantly more effective than traditional keyword search or generic chatbot implementations.

### Product Design Objectives

CortexDocs AI was intentionally designed to demonstrate strong full-stack engineering capabilities alongside meaningful AI integration. Rather than building a generic conversational interface, the system emphasizes grounded AI usage, persistent data management, secure user authentication, and clear architectural separation between frontend, backend, database, and AI components. This ensures the product reflects real-world engineering standards and production-ready design principles.

**3\. Target Audience**
-----------------------

### **Primary Users**

CortexDocs AI is designed for university students who are preparing for assessments, revising lecture materials, or navigating lengthy academic resources. It is also valuable for professionals reviewing technical documentation, specifications, reports, or compliance materials, as well as internal teams working with policy documents and requirement files. These users often rely on dense, information-heavy content that requires careful reading and frequent reference.

### **Characteristics**

The target audiences share common characteristics: they regularly engage with long-form documents, need to retrieve specific information quickly, and depend on accurate, context-grounded answers. Rather than manually scanning through pages of text, they prefer an intuitive conversational interface that allows them to query documents directly and receive precise responses grounded in the original material.

**4\. User Pain Points**
------------------------

### **1\. Manual Document Scanning**

Users often work with long PDFs, research papers, technical specifications, or policy documents that can span dozens or even hundreds of pages. Finding specific information typically requires scrolling, skimming, and repeatedly using keyword search functions that may not capture contextual meaning. This process is time-consuming, mentally exhausting, and inefficient, especially when deadlines are tight or when users need to compare multiple sections of a document. Traditional document viewers are not designed for intelligent information retrieval, forcing users to rely heavily on manual effort.

### **2\. Poor AI Grounding**

While generic AI chatbots can answer questions quickly, they frequently generate responses that are not strictly based on the uploaded material. This leads to hallucinations, assumptions, or answers that go beyond the document’s actual content. For academic, technical, or policy-related tasks, inaccurate information can be misleading and potentially harmful. Users need confidence that responses are grounded in their specific documents rather than in the model’s general training data.

### **3\. Lack of Context Retention**

Many document analysis tools fail to maintain structured conversation history tied to specific documents. Users may ask follow-up questions that depend on earlier context, but basic tools treat each query independently. This disrupts workflow and forces users to restate information repeatedly. Without persistent chat history, it becomes difficult to build layered understanding or conduct deeper exploration of document content over time.

### **4\. Fragmented Workflow**

In many existing setups, document storage, file management, search tools, and AI assistants exist as separate systems. Users might store files in one platform, read them in another, and consult an AI tool elsewhere. This fragmentation creates friction and increases cognitive load. Switching between tools reduces productivity and interrupts focus. An integrated system that combines document management, semantic retrieval, and conversational AI into a single interface significantly improves efficiency and user experience.

CortexDocs AI addresses the above challenges by persistently storing user documents and transforming them into semantically searchable embeddings, enabling efficient vector-based retrieval of relevant content. Instead of generating open-ended responses, the system restricts answers strictly to retrieved document chunks, reducing hallucination and ensuring grounded outputs. By combining document management, semantic search, and conversational interaction within a single unified platform, CortexDocs AI eliminates fragmented workflows and streamlines the entire document analysis experience.

**5\. Core Features**
---------------------

### **Must-Have Features**

#### **1\. User Authentication**

CortexDocs AI includes secure user authentication powered by Supabase, supporting both login and signup functionality. User sessions are persisted to ensure seamless access across visits, and protected routes safeguard sensitive pages such as the Chat and Documents sections. This ensures that each user’s documents and conversations remain private and securely isolated.

#### **2\. Document Upload & Storage**

The platform supports uploading PDF and DOCX files, along with ZIP files for bulk document submission (restricted to valid PDF and DOCX contents). ZIP extraction and validation occur on the frontend before individual documents are processed by the backend ingestion pipeline. Uploaded files are securely stored in Supabase Storage, while associated metadata such as title, file path, and ownership is recorded in PostgreSQL. This separation ensures secure file handling alongside structured data management.

#### **3\. Document Ingestion Pipeline**

After upload, documents pass through an ingestion pipeline that extracts raw text (PDF and DOCX supported), segments it into overlapping chunks, and generates vector embeddings for each chunk. These embeddings are stored in the database to enable semantic retrieval. The overlapping chunk strategy improves contextual continuity during retrieval and response generation.

#### **4\. Semantic Search (RAG)**

CortexDocs AI implements a Retrieval-Augmented Generation architecture. User queries are converted into embeddings and matched against stored document vectors using similarity search. The most relevant chunks are retrieved and provided to the language model, which generates responses grounded strictly in those chunks, minimizing hallucination and improving accuracy.

#### **5\. Chat Interface**

The system provides a responsive, scrollable conversational interface where users can interact with their uploaded documents. Authentication tokens are securely attached to backend requests, chat history is persisted in the database, and the interface includes proper error handling and loading states. This ensures a smooth and reliable conversational experience.

#### **6\. Persistent Document Table**

Users can manage their uploaded files through a scrollable document table. The interface includes search functionality for quick filtering, download capability via secure signed URLs, and a modal-based upload workflow for a clean user experience. This centralizes document management within the application.

### **Nice-to-Have Features (Future)**

Future improvements may include multi-document selection for scoped querying, a folder-based document management system for better organization, support for image uploads (PNG, JPG) with text extraction capabilities, and advanced conversation grouping tied to specific documents. These features would enhance scalability, usability, and enterprise readiness.

### Feature Summary Table


| Category     | Feature                     | Description                                                                                  |
| ------------ | --------------------------- | -------------------------------------------------------------------------------------------- |
| Must-Have    | User Authentication         | Secure login/signup, session persistence, and protected routes.                              |
| Must-Have    | Document Upload & Storage   | PDF/DOCX and ZIP support, secure storage, and metadata persistence.                          |
| Must-Have    | Document Ingestion Pipeline | Text extraction, chunking, embedding generation, and vector storage.                         |
| Must-Have    | Semantic Search (RAG)       | Query embedding, similarity matching, and grounded response generation.                      |
| Must-Have    | Chat Interface              | Scrollable chat UI with token authentication, history persistence, and error/loading states. |
| Must-Have    | Persistent Document Table   | Searchable document list with download support and modal upload UI.                          |
| Nice-to-Have | Multi-Document Selection    | Ability to query across selected documents.                                                  |
| Nice-to-Have | Folder System               | Structured document organization system.                                                     |
| Nice-to-Have | Image Upload Support        | PNG/JPG ingestion with text extraction capabilities.                                         |
| Nice-to-Have | Conversation Grouping       | Chat sessions grouped and scoped by document.                                                |

**6\. AI Integration**
----------------------

### **Where and how AI is used**

AI is integrated into CortexDocs AI at multiple stages of the document processing and question-answering pipeline. When a user uploads a document, its content is extracted, segmented into overlapping chunks, and converted into vector embeddings using an embedding model. These embeddings represent the semantic meaning of each chunk and are stored in the database for efficient retrieval.

When a user submits a question, the query is also transformed into an embedding vector. The system then performs similarity search against the stored document embeddings to identify the most relevant chunks. This vector-based retrieval ensures that the system selects context based on semantic meaning rather than simple keyword matching.

Finally, a Large Language Model (LLM) generates the response using only the retrieved chunks as context. Carefully designed prompts constrain the model to remain grounded in the provided content, reducing hallucination and ensuring that answers are strictly derived from the user’s uploaded documents rather than external knowledge.

### **Why AI is appropriate**

AI is appropriate for CortexDocs AI because semantic retrieval enables more accurate and context-aware search compared to traditional keyword matching, allowing users to find relevant information even when wording differs.

Large Language Models provide natural, conversational summaries of complex document content, making information access intuitive and efficient. Embeddings support scalable document intelligence by transforming unstructured text into searchable vectors, while the Retrieval-Augmented Generation (RAG) architecture ensures responses remain grounded in retrieved content, significantly reducing hallucination risk and improving reliability.

AI is not used as a generic chatbot. It is tightly integrated with document-grounded retrieval, demonstrating practical AI application.

**7\. Monetization Consideration**
----------------------------------

### **1\. Subscription Model**

A subscription-based model could offer tiered access to the platform. A free tier would allow users to upload a limited number of documents and consume a capped amount of tokens, making it suitable for students or light usage. A Pro tier could unlock higher document limits, larger context windows for AI responses, and increased token usage, catering to power users and professionals who require more advanced capabilities.

### **2\. Usage-Based Model**

A usage-based model could charge users according to actual consumption. This might include pricing based on tokens generated by embedding and LLM usage, or fees per document processed through the ingestion pipeline. Such a model ensures users only pay for what they use, making costs more transparent and scalable for different usage patterns.

### **3\. Enterprise Licensing**

For larger organizations, an enterprise licensing model could position CortexDocs AI as an internal document intelligence platform. This would include features such as role-based access control, enhanced security configurations, and private or on-premise deployments. Enterprise plans could also offer dedicated support, custom integrations, and compliance-focused configurations tailored to organizational needs.

**8\. Technical Architecture (High-Level)**
-------------------------------------------

### **1\. Frontend**

The frontend of CortexDocs AI is built using React with Vite as the build tool, styled with Tailwind CSS, and structured using React Router for client-side routing. The Supabase JavaScript client handles authentication and communication with the database. The frontend is responsible for user authentication, managing document uploads and listings, rendering the chat interface, handling modal interactions, and retrieving session tokens to securely communicate with the backend API.

### **2\. Backend**

The backend is implemented using Node.js with the Express framework. It uses the Supabase Admin client for secure database and storage operations that require elevated privileges. The backend orchestrates the Retrieval-Augmented Generation (RAG) pipeline, manages file ingestion processing, coordinates embedding generation, and integrates with the LLM for response generation. It exposes two primary endpoints: `/chat` for conversational queries and `/documents/ingest` for document processing. All document and chat operations enforce strict ownership validation to prevent cross-user access.

### **3\. Database**

The database layer is powered by Supabase PostgreSQL. User authentication is managed through Supabase Auth, while application data is stored across structured tables including `documents`, `document_chunks`, `chats`, and `chat_messages`. Vector similarity search is implemented through a PostgreSQL RPC function that enables semantic retrieval of document chunks based on embedding similarity.

### **4\. AI Components**

The AI components consist of an embedding model (accessed via a Groq or OpenAI-compatible endpoint) and a Large Language Model for answer generation. The system follows a chunk-based retrieval pipeline: document text is split into overlapping chunks, converted into embeddings, stored in the database, and later retrieved through semantic search when a user submits a query. Below are key configuration specifications used in this demo:

- Chunk size: 1200 characters (approximate token equivalent around 600–800 tokens depending on text)
- Overlap: 200 characters
- Maximum chunks per document: 80
- Embedding model: BAAI/bge-base-en-v1.5 (768 dimensions)
- Vector index: ivfflat with cosine similarity
- Retrieval: Top-6 chunk similarity matching
- LLM model: llama-3.1-8b-instant
- LLM temperature: 0.1 to reduce hallucination
- Context truncation: 2000 characters before generation

### **5\. Deployment**

For deployment, both frontend and backend are containerized using Docker with multi-stage builds to optimize image size. Environment variables are injected at runtime to securely provide API keys and configuration values. The backend service runs on port 8080, while the frontend development server runs on port 5173. This setup supports local development and scalable production deployment.

### **Architecture Summary Table**


| Layer      | Technology / Tools                                    | Key Responsibilities                                                              |
| ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Frontend   | React (Vite), Tailwind CSS, React Router, Supabase JS | UI rendering, authentication, document management, chat interface, token handling |
| Backend    | Node.js (Express), Supabase Admin                     | RAG orchestration, ingestion processing, embedding & LLM integration              |
| API Routes | `/chat`, `/documents/ingest`                          | Chat handling and document ingestion                                              |
| Database   | Supabase PostgreSQL                                   | Store documents, chunks, chats, messages, vector search via RPC                   |
| AI Layer   | Embedding model + LLM                                 | Semantic retrieval and grounded answer generation                                 |
| Deployment | Docker (multi-stage), environment variables           | Containerized frontend/backend, runtime configuration                             |
