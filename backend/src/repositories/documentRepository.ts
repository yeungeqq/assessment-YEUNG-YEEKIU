import { supabaseAdmin } from "../config/supabase.js";

export async function findDocumentByIdAndUser(documentId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  return { document: data, error };
}

export async function createDocumentSignedUrl(filePath: string) {
  const { data, error } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(filePath, 60);

  return { signedUrl: data?.signedUrl, error };
}
