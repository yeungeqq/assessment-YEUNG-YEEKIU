import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../middleware/requireUser.js";
import {
  createChatRecord,
  deleteChatByIdAndUser,
  listChatsByUser,
  listMessagesByChat,
  updateChatTitleRecord,
} from "../repositories/chatRepository.js";
import {
  CHAT_REQUEST_SCHEMA,
  ensureProjectChatOwnership,
  ensureProjectOwnership,
  ensureChatOwnership,
  generateChatAnswer,
  insertChatMessage,
} from "../services/chatService.js";

export const chatRouter = Router();

const CREATE_CHAT_SCHEMA = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().uuid().nullable().optional(),
});

const UPDATE_CHAT_SCHEMA = z.object({
  title: z.string().min(1).max(200),
});

chatRouter.get("/chats", requireUser, async (req, res) => {
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined;

  try {
    const chats = await listChatsByUser(req.userId!, projectId);
    return res.json({ data: chats });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to load chats" });
  }
});

chatRouter.post("/chats", requireUser, async (req, res) => {
  const parsed = CREATE_CHAT_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const chat = await createChatRecord({
      userId: req.userId!,
      projectId: parsed.data.projectId ?? null,
      title: parsed.data.title,
    });
    return res.status(201).json({ data: chat });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to create chat" });
  }
});

chatRouter.get("/chats/:chatId/messages", requireUser, async (req, res) => {
  try {
    const chat = await ensureChatOwnership(req.params.chatId, req.userId!);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const messages = await listMessagesByChat(req.params.chatId, req.userId!);
    return res.json({ data: messages });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to load messages" });
  }
});

chatRouter.patch("/chats/:chatId", requireUser, async (req, res) => {
  const parsed = UPDATE_CHAT_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const chat = await updateChatTitleRecord({
      chatId: req.params.chatId,
      userId: req.userId!,
      title: parsed.data.title,
    });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    return res.json({ data: chat });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to update chat" });
  }
});

chatRouter.delete("/chats/:chatId", requireUser, async (req, res) => {
  try {
    const deleted = await deleteChatByIdAndUser(req.params.chatId, req.userId!);
    if (!deleted) return res.status(404).json({ error: "Chat not found" });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to delete chat" });
  }
});

chatRouter.post("/chat", requireUser, async (req, res) => {
  const parsed = CHAT_REQUEST_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { chatId, projectId, message } = parsed.data;
  const userId = req.userId!;

  try {
    if (projectId) {
      const project = await ensureProjectOwnership(projectId, userId);
      if (!project) {
        return res.status(403).json({ error: "Invalid project ID" });
      }
    }

    const chat = projectId
      ? await ensureProjectChatOwnership(chatId, userId, projectId)
      : await ensureChatOwnership(chatId, userId);

    if (!chat) {
      return res.status(403).json({ error: "Invalid chat ID" });
    }

    await insertChatMessage({
      chatId,
      userId,
      role: "user",
      content: message,
    });

    const answer = await generateChatAnswer(message, projectId);

    await insertChatMessage({
      chatId,
      userId,
      role: "assistant",
      content: answer,
    });

    return res.json({ answer });
  } catch (e: any) {
    console.error("CHAT ERROR:", e);
    return res.status(500).json({ error: e?.message ?? "Chat failed" });
  }
});
