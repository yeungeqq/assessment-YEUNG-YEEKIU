import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
type QueryResultRow = pg.QueryResultRow;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("Missing DATABASE_URL. Set backend/.env before using PostgreSQL.");
}

export const pool = new Pool({
  connectionString:
    DATABASE_URL ?? "postgres://cortex:cortex@localhost:5432/cortexdocs",
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params: unknown[] = []
) {
  return pool.query<T>(text, params);
}

export async function ensureDatabaseSchema() {
  await query(`alter table users add column if not exists password_hash text`);
  await query(`create unique index if not exists users_email_key on users(email)`);
  await query(`
    create table if not exists document_annotations (
      document_id uuid primary key references documents(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      annotations jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query(`
    create index if not exists document_annotations_user_id_idx
    on document_annotations(user_id)
  `);
}
