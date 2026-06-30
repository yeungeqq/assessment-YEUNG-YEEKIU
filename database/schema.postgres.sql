create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists users (
  id uuid primary key,
  email text unique,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  parent_folder_id uuid references folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references projects(id) on delete set null,
  folder_id uuid references folders(id) on delete set null,
  title text not null,
  file_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(768),
  chunk_index integer not null,
  created_at timestamptz not null default now()
);

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references projects(id) on delete set null,
  folder_id uuid references folders(id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function touch_chat_updated_at()
returns trigger
language plpgsql
as $$
begin
  update chats
  set updated_at = now()
  where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_updated_at on chat_messages;
create trigger trg_touch_chat_updated_at
after insert on chat_messages
for each row execute function touch_chat_updated_at();

create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists folders_project_id_idx on folders(project_id);
create index if not exists folders_user_id_idx on folders(user_id);
create index if not exists documents_user_id_idx on documents(user_id);
create index if not exists documents_project_id_idx on documents(project_id);
create index if not exists documents_folder_id_idx on documents(folder_id);
create index if not exists document_chunks_document_id_idx on document_chunks(document_id);
create index if not exists document_chunks_embedding_idx on document_chunks using ivfflat (embedding vector_cosine_ops);
create index if not exists chats_user_id_idx on chats(user_id);
create index if not exists chats_project_id_idx on chats(project_id);
create index if not exists chats_folder_id_idx on chats(folder_id);
create index if not exists chat_messages_chat_id_idx on chat_messages(chat_id);
