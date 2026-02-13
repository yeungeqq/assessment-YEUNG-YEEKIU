create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  file_path text not null,
  created_at timestamptz default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  chunk_index int,
  created_at timestamptz default now()
);

create table chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade,
  role text check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index on document_chunks using ivfflat (embedding vector_cosine_ops);

alter table documents add column if not exists mime_type text;