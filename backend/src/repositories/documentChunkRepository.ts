import { supabaseAdmin } from "../config/supabase.js";

type DocumentChunkInsertRow = {
  document_id: string;
  content: string;
  chunk_index: number;
  embedding: number[] | undefined;
};

export async function deleteChunksByDocumentId(documentId: string) {
  const { error } = await supabaseAdmin
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);

  return { error };
}

export async function insertDocumentChunks(rows: DocumentChunkInsertRow[]) {
  const { error } = await supabaseAdmin.from("document_chunks").insert(rows);
  return { error };
}
