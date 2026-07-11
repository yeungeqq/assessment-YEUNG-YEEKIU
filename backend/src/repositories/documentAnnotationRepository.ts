import { query } from "../config/database.js";

export async function getDocumentAnnotations(documentId: string, userId: string) {
  const { rows } = await query(
    `select da.annotations
     from document_annotations da
     join documents d on d.id = da.document_id
     where da.document_id = $1 and da.user_id = $2 and d.user_id = $2
     limit 1`,
    [documentId, userId]
  );

  return rows[0]?.annotations ?? [];
}

export async function upsertDocumentAnnotations(params: {
  documentId: string;
  userId: string;
  annotations: unknown;
}) {
  const { rows } = await query(
    `insert into document_annotations (document_id, user_id, annotations)
     values ($1, $2, $3::jsonb)
     on conflict (document_id)
     do update set annotations = excluded.annotations, updated_at = now()
     returning annotations`,
    [params.documentId, params.userId, JSON.stringify(params.annotations)]
  );

  return rows[0]?.annotations ?? [];
}
