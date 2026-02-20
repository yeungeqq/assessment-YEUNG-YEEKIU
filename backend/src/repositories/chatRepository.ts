import { supabaseAdmin } from "../config/supabase.js";

type InsertChatMessageParams = {
  chatId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
};

export async function findChatByIdAndUser(chatId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .single();

  return { chat: data, error };
}

export async function insertChatMessageRecord(params: InsertChatMessageParams) {
  const { error } = await supabaseAdmin.from("chat_messages").insert({
    chat_id: params.chatId,
    user_id: params.userId,
    role: params.role,
    content: params.content,
  });

  return { error };
}

export async function matchChunksByEmbedding(
  queryEmbedding: number[],
  matchCount: number
) {
  const { data, error } = await supabaseAdmin.rpc("match_chunks_json", {
    match_count: matchCount,
    query_embedding: queryEmbedding,
  });

  return { matches: data, error };
}
