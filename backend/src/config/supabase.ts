import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.warn(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Set backend/.env before running."
  );
}

export const supabaseAdmin = createClient(
  SUPABASE_URL || "http://localhost:54321",
  SECRET_KEY || "missing-secret-key"
);
