import { useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Send } from "lucide-react";
import * as API from "../../Api";

const COLLAPSED_WIDTH = 64;
const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

type ChatRow = {
  id: string;
  title: string | null;
  updated_at: string;
  project_id?: string | null;
};

type MsgRow = {
  role: "user" | "assistant";
  content: string;
};

type ProjectCopilotSidebarProps = {
  projectId: string;
};

function summarizeTitle(text: string) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Project chat";

  const words = cleaned.split(" ");
  const firstWords = words.slice(0, 8).join(" ");
  return firstWords.length < cleaned.length ? `${firstWords}...` : firstWords;
}

export default function ProjectCopilotSidebar({
  projectId,
}: ProjectCopilotSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadMessages(id: string) {
    const { data, error } = await API.fetchMessages(id);
    if (error) {
      setError(error.message);
      return;
    }

    setMessages((data ?? []) as MsgRow[]);
  }

  async function loadProjectChat() {
    setError(null);
    setChatId(null);
    setMessages([]);

    const { data, error } = await API.fetchChats(projectId);
    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as ChatRow[];
    setChats(rows);

    if (rows[0]?.id) {
      setChatId(rows[0].id);
      await loadMessages(rows[0].id);
    }
  }

  useEffect(() => {
    void loadProjectChat();
  }, [projectId]);

  async function createProjectChat(title: string) {
    const { data, error } = await API.createChat(title, projectId);
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create copilot chat.");
    }

    const row = data as ChatRow;
    setChats((prev) => [row, ...prev.filter((chat) => chat.id !== row.id)]);
    setChatId(row.id);
    setMessages([]);
    return row;
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      let activeChatId = chatId;
      const isFirstMessage = messages.length === 0;

      if (!activeChatId) {
        const row = await createProjectChat(summarizeTitle(text));
        activeChatId = row.id;
      } else if (isFirstMessage) {
        const title = summarizeTitle(text);
        const { data } = await API.updateChatTitle(activeChatId, title);
        if (data) {
          setChats((prev) =>
            prev.map((chat) => (chat.id === activeChatId ? (data as ChatRow) : chat))
          );
        }
      }

      const response = await API.sendMessage(activeChatId, text, projectId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.answer ?? "(no answer)" },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "Copilot failed.");
    } finally {
      setLoading(false);
    }
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    function onPointerMove(moveEvent: PointerEvent) {
      const nextWidth = startWidth + startX - moveEvent.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth)));
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-slate-200 bg-white transition-[width] duration-200"
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
    >
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize copilot sidebar"
          onPointerDown={startResize}
          className="absolute left-[-3px] top-0 z-20 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-blue-400/50"
        />
      )}

      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label={collapsed ? "Expand copilot" : "Collapse copilot"}
          title={collapsed ? "Expand copilot" : "Collapse copilot"}
        >
          {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        {!collapsed && (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <Bot size={18} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">
                Project Copilot
              </div>
              <div className="text-xs text-slate-500">Scoped to this project</div>
            </div>
          </>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-1 items-start justify-center py-4 text-slate-500">
          <Bot size={20} />
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 px-4 py-3">
            <select
              value={chatId ?? ""}
              onChange={(event) => {
                const nextChatId = event.target.value;
                setChatId(nextChatId || null);
                if (nextChatId) void loadMessages(nextChatId);
              }}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">New project enquiry</option>
              {chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title ?? "Untitled enquiry"}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !loading ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Ask a question about the selected project. Answers are retrieved from
                documents uploaded to this project.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={["flex", isUser ? "justify-end" : "justify-start"].join(
                        " "
                      )}
                    >
                      <div
                        className={[
                          "max-w-[88%] rounded-md px-3 py-2 text-sm leading-6",
                          isUser
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-800",
                        ].join(" ")}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="text-sm text-slate-500">Copilot is thinking...</div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="mx-4 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="border-t border-slate-200 p-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask about this project's documents..."
                rows={2}
                className="min-h-11 flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send enquiry"
                title="Send enquiry"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
