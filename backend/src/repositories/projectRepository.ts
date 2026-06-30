import { query } from "../config/database.js";

export async function listProjectsByUser(userId: string) {
  const { rows } = await query(
    `select id, name, description, created_at, updated_at
     from projects
     where user_id = $1
     order by updated_at desc`,
    [userId]
  );

  return rows;
}

export async function findProjectByIdAndUser(projectId: string, userId: string) {
  const { rows } = await query(
    `select id, name, description, created_at, updated_at
     from projects
     where id = $1 and user_id = $2
     limit 1`,
    [projectId, userId]
  );

  return { project: rows[0] ?? null, error: null };
}

export async function createProjectRecord(params: {
  userId: string;
  name: string;
  description: string | null;
}) {
  const { rows } = await query(
    `insert into projects (user_id, name, description)
     values ($1, $2, $3)
     returning id, name, description, created_at, updated_at`,
    [params.userId, params.name, params.description]
  );

  return rows[0];
}

export async function listFoldersByProject(projectId: string, userId: string) {
  const { rows } = await query(
    `select id, name, parent_folder_id, created_at, updated_at
     from folders
     where project_id = $1 and user_id = $2
     order by created_at asc`,
    [projectId, userId]
  );

  return rows;
}

export async function findFolderByIdUserAndProject(
  folderId: string,
  userId: string,
  projectId: string
) {
  const { rows } = await query(
    `select id, name, project_id, parent_folder_id, created_at, updated_at
     from folders
     where id = $1 and user_id = $2 and project_id = $3
     limit 1`,
    [folderId, userId, projectId]
  );

  return { folder: rows[0] ?? null, error: null };
}

export async function createFolderRecord(params: {
  userId: string;
  projectId: string;
  name: string;
  parentFolderId: string | null;
}) {
  const { rows } = await query(
    `insert into folders (user_id, project_id, name, parent_folder_id)
     values ($1, $2, $3, $4)
     returning id, name, parent_folder_id, created_at, updated_at`,
    [params.userId, params.projectId, params.name, params.parentFolderId]
  );

  return rows[0];
}
