import { z } from "zod";
import { embedText } from "../rag/embeddings.js";
import { answerWithSources } from "../rag/llm.js";
import {
  findChatByIdAndUser,
  findChatByIdUserAndProject,
  insertChatMessageRecord,
  matchChunksByEmbedding,
  matchProjectChunksByEmbedding,
} from "../repositories/chatRepository.js";
import { findProjectByIdAndUser } from "../repositories/projectRepository.js";

export const CHAT_REQUEST_SCHEMA = z.object({
  chatId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

const MAX_MATCHES = 6;
const SOURCE_PREVIEW_LENGTH = 1400;
const FALLBACK_ANSWER =
  "I cannot find this information in the uploaded documents.";

type InsertChatMessageParams = {
  chatId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
};

export async function ensureChatOwnership(chatId: string, userId: string) {
  const { chat, error } = await findChatByIdAndUser(chatId, userId);

  if (error || !chat) {
    return null;
  }
  return chat;
}

export async function ensureProjectOwnership(projectId: string, userId: string) {
  const { project, error } = await findProjectByIdAndUser(projectId, userId);

  if (error || !project) {
    return null;
  }
  return project;
}

export async function ensureProjectChatOwnership(
  chatId: string,
  userId: string,
  projectId: string
) {
  const { chat, error } = await findChatByIdUserAndProject(
    chatId,
    userId,
    projectId
  );

  if (error || !chat) {
    return null;
  }
  return chat;
}

export async function insertChatMessage(params: InsertChatMessageParams) {
  const { error } = await insertChatMessageRecord(params);

  if (error) {
    throw new Error(error.message);
  }
}

export async function generateChatAnswer(message: string, projectId?: string) {
  const queryEmbedding = await embedText(message);
  const { matches, error } = projectId
    ? await matchProjectChunksByEmbedding(queryEmbedding, MAX_MATCHES, projectId)
    : await matchChunksByEmbedding(queryEmbedding, MAX_MATCHES);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(matches) ? matches : [];
  if (rows.length === 0) {
    return FALLBACK_ANSWER;
  }

  const sources = rows
    .slice(0, MAX_MATCHES)
    .map(
      (row: any, i: number) =>
        `Source [S${i + 1}]\n${(row.content ?? "").slice(0, SOURCE_PREVIEW_LENGTH)}`
    );

  return answerWithSources(message, sources);
}
