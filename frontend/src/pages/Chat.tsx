import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string;

type ChatRow = {
  id: string;
  title: string | null;
  updated_at: string;
};

type MsgRow = {
  role: "user" | "assistant";
  content: string;
};

function summarizeTitle(text: string) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New chat";

  const words = cleaned.split(" ");
  const firstWords = words.slice(0, 8).join(" ");
  const title = firstWords.length < cleaned.length ? `${firstWords}…` : firstWords;

  return title.length > 60 ? `${title.slice(0, 60).trim()}…` : title;
}

export default function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");

  // --- auto-scroll refs
  const bottomRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }

  useEffect(() => {
    scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  async function loadChats(selectFirstIfEmpty = true) {
    setError(null);

    const { data, error } = await supabase
      .from("chats")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as ChatRow[];
    setChats(rows);

    if (selectFirstIfEmpty && !chatId && rows[0]?.id) {
      setChatId(rows[0].id);
      void loadMessages(rows[0].id);
    }
  }

  async function loadMessages(id: string) {
    setError(null);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("role,content")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setMessages((data ?? []) as MsgRow[]);
  }

  useEffect(() => {
    void loadChats(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateChatTitle(id: string, title: string) {
    const { data, error } = await supabase
      .from("chats")
      .update({ title })
      .eq("id", id)
      .select("id,title,updated_at")
      .single();

    if (error) throw new Error(error.message);

    const row = data as ChatRow;
    setChats((prev) => prev.map((c) => (c.id === id ? row : c)));
    return row;
  }

  async function createChatWithTitle(title: string) {
    setError(null);

    const { data, error } = await supabase
      .from("chats")
      .insert({ title })
      .select("id,title,updated_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create chat");
    }

    const row = data as ChatRow;
    setChats((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
    setChatId(row.id);
    setMessages([]);

    return row;
  }

  async function createChat() {
    try {
      return await createChatWithTitle("New chat");
    } catch (e: any) {
      setError(e?.message || "Failed to create chat");
      return null;
    }
  }

  // -----------------------------
  // Right-click context menu + delete modal
  // -----------------------------
  const [ctxMenu, setCtxMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    chat: ChatRow | null;
  }>({ open: false, x: 0, y: 0, chat: null });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    chat: ChatRow | null;
  }>({ open: false, chat: null });

  const ctxMenuRef = useRef<HTMLDivElement | null>(null);

  function openCtxMenu(e: React.MouseEvent, chat: ChatRow) {
    e.preventDefault();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, chat });
  }

  function closeCtxMenu() {
    setCtxMenu((p) => ({ ...p, open: false, chat: null }));
  }

  function askDelete(chat: ChatRow) {
    closeCtxMenu();
    setDeleteModal({ open: true, chat });
  }

  function closeDeleteModal() {
    setDeleteModal({ open: false, chat: null });
  }

  async function deleteChat(chat: ChatRow) {
    setError(null);

    try {
      // Delete messages first (unless you have ON DELETE CASCADE)
      const { error: msgErr } = await supabase
        .from("chat_messages")
        .delete()
        .eq("chat_id", chat.id);

      if (msgErr) throw new Error(msgErr.message);

      const { error: chatErr } = await supabase.from("chats").delete().eq("id", chat.id);
      if (chatErr) throw new Error(chatErr.message);

      setChats((prev) => prev.filter((c) => c.id !== chat.id));

      if (chatId === chat.id) {
        setChatId(null);
        setMessages([]);
      }

      closeDeleteModal();
    } catch (e: any) {
      setError(e?.message || "Failed to delete chat");
    }
  }

  useEffect(() => {
    function onMouseDown(ev: MouseEvent) {
      if (!ctxMenu.open) return;
      const el = ctxMenuRef.current;
      if (el && ev.target instanceof Node && !el.contains(ev.target)) {
        closeCtxMenu();
      }
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        closeCtxMenu();
        closeDeleteModal();
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxMenu.open, deleteModal.open]);

  async function send() {
    const text = input.trim();
    if (!text) return;

    setError(null);

    // snapshot BEFORE optimistic append
    const activeChatIdBefore = chatId;
    const activeChatBefore = activeChatIdBefore
      ? chats.find((c) => c.id === activeChatIdBefore)
      : null;

    const chatLooksUntitled =
      !activeChatBefore?.title || activeChatBefore.title.trim() === "New chat";

    const chatIsEmptyBeforeSend = messages.length === 0;

    // optimistic user message
    const userMsg: MsgRow = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // If no chat selected, create placeholder one first
      let activeChatId = activeChatIdBefore;
      if (!activeChatId) {
        const row = await createChatWithTitle("New chat");
        activeChatId = row.id;
      }

      // If this chat is empty and still "New chat", rename it using the first question
      if (chatIsEmptyBeforeSend && chatLooksUntitled) {
        const newTitle = summarizeTitle(text);
        await updateChatTitle(activeChatId, newTitle);
        void loadChats(false);
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatId: activeChatId,
          message: userMsg.content,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.answer ?? "(no answer)" },
      ]);

      void loadMessages(activeChatId);
      void loadChats(false);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  const sidebarChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return chats;

    return chats.filter((c) =>
      (c.title ?? "Untitled chat").toLowerCase().includes(q)
    );
  }, [chats, chatSearch]);

  return (
    <div className="flex gap-0 h-[80vh] min-h-0 bg-white border border-slate-200 rounded-md overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 bg-blue-100/70 border-r border-slate-200 flex flex-col min-h-0">
        {/* Top: create button */}
        <div className="p-4">
          <button
            className="w-full flex items-center gap-2 bg-blue-200 hover:bg-blue-300 text-slate-800 font-semibold rounded-md px-3 py-2 transition"
            onClick={createChat}
          >
            <span className="text-lg leading-none">+</span>
            Create New Chat
          </button>
        </div>

        {/* Middle: scrollable chat list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 pr-2">
          {sidebarChats.map((c) => {
            const active = c.id === chatId;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setChatId(c.id);
                  void loadMessages(c.id);
                }}
                onContextMenu={(e) => openCtxMenu(e, c)}
                className={[
                  "w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition",
                  active
                    ? "bg-white/70 border border-white text-slate-900 font-semibold"
                    : "text-slate-700 hover:bg-white/60",
                ].join(" ")}
              >
                {c.title ?? "Untitled chat"}
              </button>
            );
          })}

          {sidebarChats.length === 0 && (
            <div className="text-xs text-slate-500 px-2 py-2">
              Submit enquiries to create a chat...
            </div>
          )}
        </div>

        {/* Bottom: search bar pinned to bottom */}
        <div className="p-3 border-t border-slate-200 bg-blue-100/70">
          <div className="relative">
            <input
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Search chats…"
              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {chatSearch && (
              <button
                onClick={() => setChatSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-sm"
                aria-label="Clear search"
                type="button"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex-1 bg-slate-50 min-h-0">
        <div className="h-full flex flex-col bg-slate-100 min-h-0">
          {error && (
            <div className="mx-8 mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={idx}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={[
                        "max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-6 shadow-sm",
                        isUser
                          ? "bg-blue-500 text-white rounded-br-sm"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm",
                      ].join(" ")}
                    >
                      <div className="font-semibold mb-1">
                        {isUser ? "You:" : "CortexDocs AI Assistant:"}
                      </div>
                      <div>{m.content}</div>
                    </div>
                  </div>
                );
              })}

              {loading && <div className="text-slate-500 text-sm">Thinking…</div>}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="px-8 pb-8">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send();
                  }}
                  placeholder="Enter enquiries here...."
                  className="w-full h-14 rounded-full border border-slate-200 bg-white px-6 pr-14 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => void send()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center transition"
                  aria-label="Send"
                  disabled={loading}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Context menu */}
      {ctxMenu.open && ctxMenu.chat && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeCtxMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeCtxMenu();
          }}
        >
          <div
            ref={ctxMenuRef}
            className="fixed z-50 w-44 rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-red-600"
              onClick={() => askDelete(ctxMenu.chat!)}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && deleteModal.chat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={closeDeleteModal} />
          <div className="relative w-full max-w-md mx-4 rounded-xl bg-white border border-slate-200 shadow-xl p-5">
            <div className="text-lg font-semibold text-slate-900">Delete chat?</div>
            <div className="mt-2 text-sm text-slate-600">
              This will permanently delete{" "}
              <span className="font-semibold text-slate-800">
                {deleteModal.chat.title ?? "Untitled chat"}
              </span>{" "}
              and all its messages.
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                onClick={closeDeleteModal}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
                onClick={() => void deleteChat(deleteModal.chat!)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}