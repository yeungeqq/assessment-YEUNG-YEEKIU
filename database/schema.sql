-- ----------------------------
-- Extensions
-- ----------------------------
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ----------------------------
-- Tables
-- ----------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  file_path text not null,
  mime_type text,
  created_at timestamptz default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  content text not null,
  embedding vector(768),
  chunk_index int,
  created_at timestamptz default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- ----------------------------
-- Indexes
-- ----------------------------

create index if not exists document_chunks_embedding_idx
on public.document_chunks
using ivfflat (embedding vector_cosine_ops);

create index if not exists chat_messages_chat_id_idx
on public.chat_messages(chat_id);

create index if not exists chat_messages_user_id_idx
on public.chat_messages(user_id);

-- ----------------------------
-- RAG Retrieval Function
-- ----------------------------
create or replace function public.match_chunks(
  query_embedding vector,
  match_count int
)
returns table (
  content text,
  document_id uuid,
  chunk_index int,
  similarity double precision
)
language sql stable
as $$
  select
    dc.content,
    dc.document_id,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- ----------------------------
-- Trigger: update chats.updated_at on new message
-- ----------------------------
create or replace function public.touch_chat_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.chats
  set updated_at = now()
  where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_updated_at on public.chat_messages;

create trigger trg_touch_chat_updated_at
after insert on public.chat_messages
for each row execute function public.touch_chat_updated_at();

-- ----------------------------
-- Enable RLS
-- ----------------------------
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

-- ----------------------------
-- Policies (drop + recreate for idempotency)
-- ----------------------------

-- Documents: only owner can access
drop policy if exists documents_select_own on public.documents;
drop policy if exists documents_insert_own on public.documents;
drop policy if exists documents_update_own on public.documents;
drop policy if exists documents_delete_own on public.documents;

create policy documents_select_own
on public.documents
for select
to authenticated
using (user_id = auth.uid());

create policy documents_insert_own
on public.documents
for insert
to authenticated
with check (user_id = auth.uid());

create policy documents_update_own
on public.documents
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy documents_delete_own
on public.documents
for delete
to authenticated
using (user_id = auth.uid());

-- Document chunks: access via owning document
drop policy if exists chunks_select_own on public.document_chunks;
drop policy if exists chunks_insert_own on public.document_chunks;
drop policy if exists chunks_delete_own on public.document_chunks;

create policy chunks_select_own
on public.document_chunks
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_chunks.document_id
      and d.user_id = auth.uid()
  )
);

create policy chunks_insert_own
on public.document_chunks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_chunks.document_id
      and d.user_id = auth.uid()
  )
);

create policy chunks_delete_own
on public.document_chunks
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_chunks.document_id
      and d.user_id = auth.uid()
  )
);

-- Chats: only owner
drop policy if exists chats_select_own on public.chats;
drop policy if exists chats_insert_own on public.chats;
drop policy if exists chats_update_own on public.chats;
drop policy if exists chats_delete_own on public.chats;

create policy chats_select_own
on public.chats
for select
to authenticated
using (user_id = auth.uid());

create policy chats_insert_own
on public.chats
for insert
to authenticated
with check (user_id = auth.uid());

create policy chats_update_own
on public.chats
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy chats_delete_own
on public.chats
for delete
to authenticated
using (user_id = auth.uid());

-- Chat messages: only owner rows
drop policy if exists msgs_select_own on public.chat_messages;
drop policy if exists msgs_insert_own on public.chat_messages;
drop policy if exists msgs_delete_own on public.chat_messages;

create policy msgs_select_own
on public.chat_messages
for select
to authenticated
using (user_id = auth.uid());

create policy msgs_insert_own
on public.chat_messages
for insert
to authenticated
with check (user_id = auth.uid());

create policy msgs_delete_own
on public.chat_messages
for delete
to authenticated
using (user_id = auth.uid());

-- ============================================
-- Supabase Storage Setup (Bucket + Policies)
-- ============================================

-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Ensure RLS is enabled on storage.objects (usually already true)
alter table storage.objects enable row level security;

-- Drop old policies if present (avoid duplicates)
drop policy if exists "Users can upload to their own folder" on storage.objects;
drop policy if exists "Users can read their own files" on storage.objects;
drop policy if exists "Users can delete their own files" on storage.objects;

-- Upload: documents/<user_id>/...
create policy "Users can upload to their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Read: documents/<user_id>/...
create policy "Users can read their own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Delete: documents/<user_id>/...
create policy "Users can delete their own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);