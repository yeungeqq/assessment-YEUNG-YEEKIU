import { query } from "../config/database.js";

type RepositoryError = { message: string } | null;

export async function listDocumentsByUser(userId: string, projectId?: string) {
  const { rows } = projectId
    ? await query(
        `select id, title, file_path, created_at, project_id, folder_id
         from documents
         where user_id = $1 and project_id = $2
         order by created_at desc`,
        [userId, projectId]
      )
    : await query(
        `select id, title, file_path, created_at, project_id, folder_id
         from documents
         where user_id = $1
         order by created_at desc`,
        [userId]
      );

  return rows;
}

export async function findDocumentByIdAndUser(documentId: string, userId: string) {
  const { rows } = await query(
    `select *
     from documents
     where id = $1 and user_id = $2
     limit 1`,
    [documentId, userId]
  );

  return { document: rows[0] ?? null, error: null as RepositoryError };
}

export async function findDocumentByIdUserAndProject(
  documentId: string,
  userId: string,
  projectId: string
) {
  const { rows } = await query(
    `select *
     from documents
     where id = $1 and user_id = $2 and project_id = $3
     limit 1`,
    [documentId, userId, projectId]
  );

  return { document: rows[0] ?? null, error: null as RepositoryError };
}

export async function createDocumentRecord(params: {
  userId: string;
  projectId: string | null;
  folderId: string | null;
  title: string;
  filePath: string;
  mimeType: string | null;
}) {
  const { rows } = await query(
    `insert into documents (user_id, project_id, folder_id, title, file_path, mime_type)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [
      params.userId,
      params.projectId,
      params.folderId,
      params.title,
      params.filePath,
      params.mimeType,
    ]
  );

  return rows[0];
}

export async function updateDocumentFilePath(
  documentId: string,
  userId: string,
  filePath: string
) {
  const { rows } = await query(
    `update documents
     set file_path = $3
     where id = $1 and user_id = $2
     returning id, file_path`,
    [documentId, userId, filePath]
  );

  return rows[0] ?? null;
}

export async function deleteDocumentByIdAndUser(documentId: string, userId: string) {
  const result = await query(
    `delete from documents
     where id = $1 and user_id = $2`,
    [documentId, userId]
  );

  return result.rowCount;
}
