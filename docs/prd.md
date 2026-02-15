**CortexDocs AI – Product Requirements Document**
==================================================

**1\. Product Overview**
------------------------

### **What is the product?**

**CortexDocs AI** is an AI-powered document intelligence web application that allows users to upload PDF, DOCX, and ZIP documents and interact with them through a conversational interface.

The system leverages **Retrieval-Augmented Generation (RAG)** to provide contextual, accurate answers grounded strictly in user-uploaded content.

### **What problem does it solve?**

Professionals and students frequently need to extract information from long documents such as reports, assessments, lecture notes, or technical documentation. Manually reading and locating relevant sections is time-consuming and inefficient.

CortexDocs AI solves this by:

* Converting documents into searchable semantic embeddings
* Performing vector-based retrieval
* Generating AI responses grounded in retrieved document chunks
* Providing an interactive chat interface for follow-up questions

**2\. Idea Derivation**
-----------------------

The idea originated from the increasing reliance on AI copilots for productivity tasks, combined with the observation that many AI tools hallucinate when answering document-based questions.

During experimentation with LLM APIs and Supabase vector search, it became clear that combining:

* Document chunking
* Embeddings
* Vector similarity search
* Controlled answer generation

creates a practical and high-value tool for document understanding.

The product was designed to:

* Demonstrate strong full-stack engineering
* Apply AI meaningfully (not just generic chatbot usage)
* Implement persistent data + secure user authentication
* Show proper architecture and separation of concerns

**3\. Target Audience**
-----------------------

### **Primary Users**

* University students preparing for study and assessment
* Professionals reviewing technical documentation
* Internal teams handling policy or requirement documents

### **Characteristics**

* Frequently interact with long-form documents
* Require fast information retrieval
* Need accurate, context-grounded answers
* Prefer conversational interfaces over manual search

**4\. User Pain Points**
------------------------

### **1\. Manual Document Scanning**

Users must scroll through large PDFs or word documents to find relevant information.

### **2\. Poor AI Grounding**

Generic chatbots hallucinate or answer beyond document scope.

### **3\. Lack of Context Retention**

Basic tools do not maintain chat history tied to documents.

### **4\. Fragmented Workflow**

Document storage, search, and AI querying are often separate tools.

CortexDocs AI addresses these by:

* Storing documents persistently
* Performing semantic retrieval via vector search
* Restricting answers to retrieved document chunks
* Integrating document management and chat in one system

**5\. Core Features**
---------------------

### **Must-Have Features**

#### **1\. User Authentication**

* Supabase-based secure login/signup
* Session persistence
* Protected routes (Chat & Documents)

#### **2\. Document Upload & Storage**

* PDF and DOCX support
* ZIP file bulk upload support (contains only PDF and DOCX)
* Secure storage in Supabase Storage
* Metadata stored in PostgreSQL

#### **3\. Document Ingestion Pipeline**

* Text extraction (PDF / DOCX)
* Chunking strategy (overlapping chunks)
* Embedding generation
* Vector storage in database

#### **4\. Semantic Search (RAG)**

* Embed user query
* Match relevant document chunks
* Generate grounded response

#### **5\. Chat Interface**

* Scrollable conversation
* Token-based authentication
* Error handling
* Loading states

#### **6\. Persistent Document Table**

* Scrollable document list
* Search functionality
* Download capability
* Modal upload UI

### **Nice-to-Have Features (Future)**

* Multi-document selection
* Chat history persistence in DB
* Image files (PNG, JPG) uploading and extraction
* Conversation grouping by document

**6\. AI Integration**
----------------------

### **Where AI is used**

* Convert document chunks into vector embeddings
* Convert user queries into embeddings
* Similarity search against stored embeddings
* LLM generates response using only retrieved chunks
* Prompt engineering restricts hallucination

### **Why AI is appropriate**

* Semantic retrieval outperforms keyword search
* LLM summarization allows conversational access
* Embeddings allow scalable document intelligence
* RAG architecture reduces hallucination risk

AI is not used as a generic chatbot. It is tightly integrated with document-grounded retrieval, demonstrating practical AI application.

**7\. Monetization Consideration**
----------------------------------

### **1\. Subscription Model**

* Free tier (limited uploads & tokens)
* Pro tier (higher document limits, larger context window)

### **2\. Usage-Based Model**

* Pay per token
* Pay per document processed

### **3\. Enterprise Licensing**

* Internal company document intelligence platform
* Role-based access control
* Private deployments

**8\. Technical Architecture (High-Level)**
-------------------------------------------

### **Frontend**

* React (Vite)
* Tailwind CSS
* React Router
* Supabase JS client

**Responsibilities:**

* Authentication
* Document management UI
* Chat interface
* Modal interactions
* Token retrieval for backend requests

### **Backend**

* Node.js (Express)
* Supabase Admin client
* RAG orchestration logic
* File ingestion processing
* Embedding & LLM integration

**Endpoints:**

* /chat
* /documents/ingest

### **Database**

* Supabase PostgreSQL
* * users (managed by Supabase Auth)
  * documents
  * document\_chunks
  * chats
  * chat_messages
* Vector similarity search via RPC function

### **AI Components**

* Embedding model (via Groq / OpenAI-compatible endpoint)
* LLM for answer generation
* Chunk-based retrieval pipeline

### **Deployment Approach**

* Dockerized frontend and backend
* Multi-stage builds
* Environment variables injected at runtime
* Backend exposes port 8080
* Frontend exposes port 5173
