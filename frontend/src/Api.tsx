// src/Api.tsx
import { supabase } from "./supabaseClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string;

// AUTH
export async function login(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signup(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function getCurrentUser() {
  return supabase.auth.getUser();
}

export async function getSessionToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// CHATS
export async function fetchChats() {
  return supabase
    .from("chats")
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false });
}

export async function fetchMessages(chatId: string) {
  return supabase
    .from("chat_messages")
    .select("role,content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
}

export async function createChat(title: string) {
  return supabase
    .from("chats")
    .insert({ title })
    .select("id,title,updated_at")
    .single();
}

export async function removeChat(chatId: string) {
  await supabase.from("chat_messages").delete().eq("chat_id", chatId);
  return supabase.from("chats").delete().eq("id", chatId);
}

export async function updateChatTitle(chatId: string, title: string) {
  return supabase
    .from("chats")
    .update({ title })
    .eq("id", chatId)
    .select("id,title,updated_at")
    .single();
}

export async function sendMessage(chatId: string, message: string) {
  const token = await getSessionToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId, message }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || "Request failed");
  return json as { answer?: string };
}

// DOCUMENTS
export async function fetchDocuments(userId: string) {
  return supabase
    .from("documents")
    .select("id,title,file_path,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function createDocumentRow(input: {
  user_id: string;
  title: string;
  file_path: string;
  mime_type: string | null;
}) {
  return supabase
    .from("documents")
    .insert(input)
    .select("id")
    .single();
}

export async function deleteDocumentRow(documentId: string) {
  return supabase.from("documents").delete().eq("id", documentId);
}

export async function removeStorageFile(path: string) {
  return supabase.storage.from("documents").remove([path]);
}

export async function uploadFileToStorage(path: string, file: File) {
  return supabase.storage.from("documents").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
}

export async function createDownloadUrl(path: string, seconds = 60) {
  return supabase.storage.from("documents").createSignedUrl(path, seconds);
}

export async function callIngest(documentId: string) {
  const token = await getSessionToken();
  if (!token) throw new Error("Not authenticated");

  const resp = await fetch(`${BACKEND_URL}/documents/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ documentId }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((body as any)?.error ?? "Ingest failed");
  return body as { ok?: boolean; chunks?: number };
}