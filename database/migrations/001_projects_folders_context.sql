create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  parent_folder_id uuid references public.folders(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.documents add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.documents add column if not exists folder_id uuid references public.folders(id) on delete set null;
alter table public.chats add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.chats add column if not exists folder_id uuid references public.folders(id) on delete set null;

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists folders_project_id_idx on public.folders(project_id);
create index if not exists folders_user_id_idx on public.folders(user_id);
create index if not exists documents_project_id_idx on public.documents(project_id);
create index if not exists documents_folder_id_idx on public.documents(folder_id);
create index if not exists chats_project_id_idx on public.chats(project_id);
create index if not exists chats_folder_id_idx on public.chats(folder_id);

create or replace function public.match_project_chunks_json(
  query_embedding jsonb,
  match_count integer,
  target_project_id uuid
)
returns table(content text, document_id uuid, chunk_index integer, similarity double precision)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select ('[' || string_agg(elem, ',') || ']')::vector as v
    from jsonb_array_elements_text(query_embedding) as t(elem)
  )
  select
    dc.content,
    dc.document_id,
    dc.chunk_index,
    1 - (dc.embedding <=> q.v) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  cross join q
  where d.project_id = target_project_id
  order by dc.embedding <=> q.v
  limit match_count;
$$;

alter table public.projects enable row level security;
alter table public.folders enable row level security;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists folders_select_own on public.folders;
create policy folders_select_own on public.folders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists folders_insert_own on public.folders;
create policy folders_insert_own on public.folders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = folders.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists folders_update_own on public.folders;
create policy folders_update_own on public.folders
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists folders_delete_own on public.folders;
create policy folders_delete_own on public.folders
  for delete to authenticated using (auth.uid() = user_id);

grant all on table public.projects to anon, authenticated, service_role;
grant all on table public.folders to anon, authenticated, service_role;
grant all on function public.match_project_chunks_json(jsonb, integer, uuid) to anon, authenticated, service_role;
