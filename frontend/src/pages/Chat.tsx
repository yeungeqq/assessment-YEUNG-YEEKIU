import { useEffect, useMemo, useState } from "react";
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

export default function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);

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

  async function createChat() {
    setError(null);

    const { data, error } = await supabase
      .from("chats")
      .insert({ title: "New chat" })
      .select("id,title,updated_at")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Failed to create chat");
      return;
    }

    // Put it on top and select it
    setChats((prev) => [data as ChatRow, ...prev]);
    setChatId((data as ChatRow).id);
    setMessages([]);
  }

  async function send() {
    if (!input.trim()) return;
    if (!chatId) {
      setError("No chat selected.");
      return;
    }

    setError(null);

    const userMsg: MsgRow = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatId,
          message: userMsg.content,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");

      // Option A: append assistant msg from response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.answer ?? "(no answer)" },
      ]);

      // Optionally refresh from DB to ensure persistence + correct ordering
      void loadMessages(chatId);
      void loadChats(false); // updated_at refresh
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  const sidebarChats = useMemo(() => chats, [chats]);

  return (
    <div className="flex gap-0 min-h-[78vh] bg-white border border-slate-200 rounded-md overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 bg-blue-100/70 border-r border-slate-200">
        <div className="p-4">
          <button
            className="w-full flex items-center gap-2 bg-blue-200 hover:bg-blue-300 text-slate-800 font-semibold rounded-md px-3 py-2 transition"
            onClick={createChat}
          >
            <span className="text-lg leading-none">+</span>
            Create New Chat
          </button>
        </div>

        <div className="px-3 pb-4">
          <div className="h-[60vh] overflow-auto pr-1">
            {sidebarChats.map((c) => {
              const active = c.id === chatId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setChatId(c.id);
                    void loadMessages(c.id);
                  }}
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
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex-1 bg-slate-50">
        <div className="h-[calc(85vh-56px)] flex flex-col bg-slate-100">
          {/* Errors */}
          {error && (
            <div className="mx-8 mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-4 max-w-3xl">
              {messages.map((m, idx) => (
                <div key={idx} className="text-slate-800 text-base leading-7">
                  <span className="font-semibold">
                    {m.role === "user" ? "You:" : "CortexDocs AI Assistant:"}
                  </span>{" "}
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="text-slate-500 text-sm">Thinking…</div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="px-8 pb-8">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send();
                  }}
                  placeholder="enter enquiries here...."
                  className="w-full h-14 rounded-full border border-slate-200 bg-white px-6 pr-14 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => void send()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center transition"
                  aria-label="Send"
                  disabled={loading}
                >
                  ⬆️
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}