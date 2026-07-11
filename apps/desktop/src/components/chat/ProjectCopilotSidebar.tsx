import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  MessageSquare,
  Pencil,
  Plus,
} from "lucide-react";
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

type CopilotView = "sessions" | "conversation";

function summarizeTitle(text: string) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Project chat";

  const words = cleaned.split(" ");
  const firstWords = words.slice(0, 8).join(" ");
  return firstWords.length < cleaned.length ? `${firstWords}...` : firstWords;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return <span key={index}>{part}</span>;
  });
}

function renderMarkdownLine(line: string, key: string) {
  const heading = /^(#{1,6})\s+(.+)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const className =
      level <= 2
        ? "text-base font-bold text-slate-900"
        : "text-sm font-bold text-slate-900";

    return (
      <div key={key} className={className}>
        {renderInlineMarkdown(heading[2])}
      </div>
    );
  }

  const listItem = /^([-*]|\d+\.)\s+(.+)$/.exec(line);
  if (listItem) {
    return (
      <li key={key} className="ml-4 pl-1">
        {renderInlineMarkdown(listItem[2])}
      </li>
    );
  }

  return (
    <p key={key} className="whitespace-pre-wrap">
      {renderInlineMarkdown(line)}
    </p>
  );
}

function FormattedAssistantMessage({ content }: { content: string }) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isList = lines.every((line) => /^([-*]|\d+\.)\s+/.test(line));

        if (isList) {
          return (
            <ul key={blockIndex} className="list-disc space-y-2 pl-4">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInlineMarkdown(line.replace(/^([-*]|\d+\.)\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div key={blockIndex} className="space-y-2">
            {lines.map((line, lineIndex) =>
              renderMarkdownLine(line, `${blockIndex}-${lineIndex}`)
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectCopilotSidebar({
  projectId,
}: ProjectCopilotSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [view, setView] = useState<CopilotView>("sessions");
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [sessionMenuChatId, setSessionMenuChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [modelConfig, setModelConfig] = useState<API.ModelConfigResponse | null>(
    null
  );
  const [llmModelId, setLlmModelId] = useState("");
  const [embeddingModelId, setEmbeddingModelId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (renamingChatId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingChatId]);

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
    setInput("");
    setView("sessions");

    const { data, error } = await API.fetchChats(projectId);
    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as ChatRow[];
    setChats(rows);
  }

  useEffect(() => {
    void loadProjectChat();
  }, [projectId]);

  useEffect(() => {
    async function loadModelConfig() {
      const { data, error } = await API.fetchModelConfig();
      if (error) {
        setError(error.message);
        return;
      }

      if (!data) return;
      const enabledLlmModels = data.llm.filter((model) => model.enabled);
      const defaultLlmModel =
        enabledLlmModels.find((model) => model.id === data.defaults.llmModelId)
          ?.id ??
        enabledLlmModels[0]?.id ??
        data.defaults.llmModelId;

      setModelConfig(data);
      setLlmModelId((current) => current || defaultLlmModel);
      setEmbeddingModelId(
        (current) => current || data.defaults.embeddingModelId
      );
    }

    void loadModelConfig();
  }, []);

  async function createProjectChat(title: string) {
    const { data, error } = await API.createChat(title, projectId);
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create copilot chat.");
    }

    const row = data as ChatRow;
    setChats((prev) => [row, ...prev.filter((chat) => chat.id !== row.id)]);
    setChatId(row.id);
    setMessages([]);
    setView("conversation");
    return row;
  }

  async function openChat(chat: ChatRow) {
    setError(null);
    setInput("");
    setChatId(chat.id);
    setView("conversation");
    await loadMessages(chat.id);
  }

  function startNewChat() {
    setError(null);
    setChatId(null);
    setMessages([]);
    setInput("");
    setView("conversation");
  }

  async function openRenameOnTitleBar(chat: ChatRow) {
    setSessionMenuChatId(null);
    setChatId(chat.id);
    setView("conversation");
    setRenameTitle(chat.title ?? "Untitled session");
    setRenamingChatId(chat.id);
    await loadMessages(chat.id);
  }

  async function saveRename() {
    if (!renamingChatId) return;

    const title = renameTitle.trim();
    if (!title) {
      setRenamingChatId(null);
      return;
    }

    const { data, error } = await API.updateChatTitle(renamingChatId, title);
    if (error) {
      setError(error.message);
      return;
    }

    if (data) {
      setChats((prev) =>
        prev.map((row) => (row.id === renamingChatId ? (data as ChatRow) : row))
      );
    }

    setRenamingChatId(null);
  }

  function goBackToSessions() {
    setError(null);
    setInput("");
    setView("sessions");
    setChatId(null);
    setMessages([]);
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

      const response = await API.sendMessage(activeChatId, text, projectId, {
        llmModelId: llmModelId || undefined,
        embeddingModelId: embeddingModelId || undefined,
      });
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
          {view === "sessions" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <button
                type="button"
                onClick={startNewChat}
                className="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={16} />
                New session
              </button>

              {chats.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No sessions yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      className="group relative rounded-md border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                    >
                      <button
                        type="button"
                        onClick={() => void openChat(chat)}
                        className="flex w-full items-start gap-3 px-3 py-3 pr-11 text-left"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                          <MessageSquare size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {chat.title ?? "Untitled session"}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {formatSessionDate(chat.updated_at)}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSessionMenuChatId((current) =>
                            current === chat.id ? null : chat.id
                          );
                        }}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 hover:bg-white hover:text-slate-700 group-hover:opacity-100"
                        aria-label="Session options"
                        title="Session options"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {sessionMenuChatId === chat.id && (
                        <div className="absolute right-2 top-10 z-30 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => void openRenameOnTitleBar(chat)}
                            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <Pencil size={14} />
                            Rename chat
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex h-12 items-center gap-2 border-b border-slate-200 px-4">
                <button
                  type="button"
                  onClick={goBackToSessions}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Back to sessions"
                  title="Back to sessions"
                >
                  <ArrowLeft size={16} />
                </button>
                {renamingChatId === chatId ? (
                  <input
                    ref={renameInputRef}
                    value={renameTitle}
                    onChange={(event) => setRenameTitle(event.target.value)}
                    onBlur={() => void saveRename()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveRename();
                      }

                      if (event.key === "Escape") {
                        setRenamingChatId(null);
                      }
                    }}
                    className="min-w-0 flex-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900 outline-none ring-2 ring-blue-100"
                  />
                ) : (
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                    {chats.find((chat) => chat.id === chatId)?.title ??
                      "New session"}
                  </div>
                )}
                {chatId && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setSessionMenuChatId((current) =>
                          current === chatId ? null : chatId
                        )
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label="Conversation options"
                      title="Conversation options"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {sessionMenuChatId === chatId && (
                      <div className="absolute right-0 top-9 z-30 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            const chat = chats.find((row) => row.id === chatId);
                            if (chat) void openRenameOnTitleBar(chat);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil size={14} />
                          Rename chat
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 && !loading ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Ask a question about this project.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message, index) => {
                      const isUser = message.role === "user";
                      return (
                        <div
                          key={`${message.role}-${index}`}
                          className={[
                            "flex",
                            isUser ? "justify-end" : "justify-start",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "max-w-[88%] rounded-md px-3 py-2 text-sm leading-6",
                              isUser
                                ? "bg-blue-600 text-white"
                                : "border border-slate-200 bg-slate-50 text-slate-800",
                            ].join(" ")}
                          >
                            {isUser ? (
                              <span className="whitespace-pre-wrap">
                                {message.content}
                              </span>
                            ) : (
                              <FormattedAssistantMessage
                                content={message.content}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {loading && (
                      <div className="text-sm text-slate-500">
                        Copilot is thinking...
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="mx-4 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {view === "conversation" && (
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Enter messages and enquiries..."
                  rows={2}
                  className="min-h-12 w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
                />

                <div className="mt-3 flex h-8 items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
                    aria-label="Add attachment"
                    title="Add attachment"
                  >
                    <Plus size={18} />
                  </button>

                  <div className="ml-auto flex min-w-0 items-center gap-2">
                    <div className="relative min-w-0">
                      <select
                        value={llmModelId}
                        onChange={(event) => setLlmModelId(event.target.value)}
                        className="h-8 max-w-[200px] appearance-none rounded-md bg-transparent py-0 pl-2 pr-6 text-xs font-medium text-slate-600 outline-none hover:bg-white focus:bg-white focus:text-slate-900"
                        aria-label="LLM model"
                        title="LLM model"
                      >
                        {!llmModelId && <option value="">Model</option>}
                        {(modelConfig?.llm ?? [])
                          .filter((model) => model.enabled)
                          .map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={13}
                        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={loading || !input.trim()}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Send enquiry"
                      title="Send enquiry"
                    >
                      <ArrowUp size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
