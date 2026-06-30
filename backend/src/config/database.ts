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
}
