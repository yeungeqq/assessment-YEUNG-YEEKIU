import { query } from "../config/database.js";

type InsertChatMessageParams = {
  chatId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
};

type RepositoryError = { message: string } | null;

export async function findChatByIdAndUser(chatId: string, userId: string) {
  const { rows } = await query(
    `select id, project_id, folder_id
     from chats
     where id = $1 and user_id = $2
     limit 1`,
    [chatId, userId]
  );

  return { chat: rows[0] ?? null, error: null as RepositoryError };
}

export async function findChatByIdUserAndProject(
  chatId: string,
  userId: string,
  projectId: string
) {
  const { rows } = await query(
    `select id, project_id, folder_id
     from chats
     where id = $1 and user_id = $2 and project_id = $3
     limit 1`,
    [chatId, userId, projectId]
  );

  return { chat: rows[0] ?? null, error: null as RepositoryError };
}

export async function listChatsByUser(userId: string, projectId?: string) {
  const { rows } = projectId
    ? await query(
        `select id, title, updated_at, project_id
         from chats
         where user_id = $1 and project_id = $2
         order by updated_at desc`,
        [userId, projectId]
      )
    : await query(
        `select id, title, updated_at, project_id
         from chats
         where user_id = $1 and project_id is null
         order by updated_at desc`,
        [userId]
      );

  return rows;
}

export async function createChatRecord(params: {
  userId: string;
  projectId: string | null;
  title: string;
}) {
  const { rows } = await query(
    `insert into chats (user_id, project_id, title)
     values ($1, $2, $3)
     returning id, title, updated_at, project_id`,
    [params.userId, params.projectId, params.title]
  );

  return rows[0];
}

export async function updateChatTitleRecord(params: {
  chatId: string;
  userId: string;
  title: string;
}) {
  const { rows } = await query(
    `update chats
     set title = $3, updated_at = now()
     where id = $1 and user_id = $2
     returning id, title, updated_at, project_id`,
    [params.chatId, params.userId, params.title]
  );

  return rows[0] ?? null;
}

export async function deleteChatByIdAndUser(chatId: string, userId: string) {
  const result = await query(
    `delete from chats
     where id = $1 and user_id = $2`,
    [chatId, userId]
  );

  return result.rowCount;
}

export async function listMessagesByChat(chatId: string, userId: string) {
  const { rows } = await query(
    `select cm.role, cm.content
     from chat_messages cm
     join chats c on c.id = cm.chat_id
     where cm.chat_id = $1 and c.user_id = $2
     order by cm.created_at asc`,
    [chatId, userId]
  );

  return rows;
}

export async function insertChatMessageRecord(params: InsertChatMessageParams) {
  await query(
    `insert into chat_messages (chat_id, user_id, role, content)
     values ($1, $2, $3, $4)`,
    [params.chatId, params.userId, params.role, params.content]
  );

  return { error: null as RepositoryError };
}

export async function matchChunksByEmbedding(
  queryEmbedding: number[],
  matchCount: number
) {
  const vector = `[${queryEmbedding.join(",")}]`;
  const { rows } = await query(
    `select
       dc.content,
       dc.document_id,
       dc.chunk_index,
       1 - (dc.embedding <=> $1::vector) as similarity
     from document_chunks dc
     order by dc.embedding <=> $1::vector
     limit $2`,
    [vector, matchCount]
  );

  return { matches: rows, error: null as RepositoryError };
}

export async function matchProjectChunksByEmbedding(
  queryEmbedding: number[],
  matchCount: number,
  projectId: string
) {
  const vector = `[${queryEmbedding.join(",")}]`;
  const { rows } = await query(
    `select
       dc.content,
       dc.document_id,
       dc.chunk_index,
       1 - (dc.embedding <=> $1::vector) as similarity
     from document_chunks dc
     join documents d on d.id = dc.document_id
     where d.project_id = $2
     order by dc.embedding <=> $1::vector
     limit $3`,
    [vector, projectId, matchCount]
  );

  return { matches: rows, error: null as RepositoryError };
}
