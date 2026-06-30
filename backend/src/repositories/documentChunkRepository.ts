import { query } from "../config/database.js";

type DocumentChunkInsertRow = {
  document_id: string;
  content: string;
  chunk_index: number;
  embedding: number[] | undefined;
};

type RepositoryError = { message: string } | null;

export async function deleteChunksByDocumentId(documentId: string) {
  await query(`delete from document_chunks where document_id = $1`, [documentId]);

  return { error: null as RepositoryError };
}

export async function insertDocumentChunks(rows: DocumentChunkInsertRow[]) {
  for (const row of rows) {
    await query(
      `insert into document_chunks (document_id, content, chunk_index, embedding)
       values ($1, $2, $3, $4::vector)`,
      [
        row.document_id,
        row.content,
        row.chunk_index,
        `[${(row.embedding ?? []).join(",")}]`,
      ]
    );
  }

  return { error: null as RepositoryError };
}
