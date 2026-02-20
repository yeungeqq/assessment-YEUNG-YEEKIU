import { Router } from "express";
import { requireUser } from "../middleware/requireUser.js";
import {
  CHAT_REQUEST_SCHEMA,
  ensureChatOwnership,
  generateChatAnswer,
  insertChatMessage,
} from "../services/chatService.js";

export const chatRouter = Router();

chatRouter.post("/chat", requireUser, async (req, res) => {
  const parsed = CHAT_REQUEST_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { chatId, message } = parsed.data;
  const userId = req.userId!;

  try {
    const chat = await ensureChatOwnership(chatId, userId);
    if (!chat) {
      return res.status(403).json({ error: "Invalid chat ID" });
    }

    await insertChatMessage({
      chatId,
      userId,
      role: "user",
      content: message,
    });

    const answer = await generateChatAnswer(message);

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
