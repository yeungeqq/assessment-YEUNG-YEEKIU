import { supabaseAdmin } from "../config/supabase.js";

export async function getUserFromToken(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return { user: data?.user ?? null, error };
}
