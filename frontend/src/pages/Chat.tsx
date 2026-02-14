import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string

export default function Chat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState("chat 1");

  const chats = useMemo(() => ["chat 1", "chat 2", "chat 3", "chat 4", "chat 5"], []);

  async function send() {
    if (!input.trim()) return
    setError(null)

    const userMsg = { role: 'user' as const, content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg.content })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Request failed')

      setMessages(prev => [...prev, { role: 'assistant', content: json.answer ?? '(no answer)' }])
    } catch (e: any) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-0 min-h-[78vh] bg-white border border-slate-200 rounded-md overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 bg-blue-100/70 border-r border-slate-200">
        <div className="p-4">
          <button className="w-full flex items-center gap-2 bg-blue-200 hover:bg-blue-300 text-slate-800 font-semibold rounded-md px-3 py-2 transition">
            <span className="text-lg leading-none">+</span>
            Create New Chat
          </button>
        </div>

        <div className="px-3 pb-4">
          <div className="h-[60vh] overflow-auto pr-1">
            {chats.map((c) => {
              const active = c === chatId;
              return (
                <button
                  key={c}
                  onClick={() => setChatId(c)}
                  className={[
                    "w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition",
                    active
                      ? "bg-white/70 border border-white text-slate-900 font-semibold"
                      : "text-slate-700 hover:bg-white/60",
                  ].join(" ")}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex-1 bg-slate-50">
        <div className="h-[calc(85vh-56px)] flex flex-col bg-slate-100">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-4 max-w-3xl">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className="text-slate-800 text-base leading-7"
                >
                  <span className="font-semibold">
                    {m.role === "user" ? "You:" : "DocuPilot:"}
                  </span>{" "}
                  {m.content}
                </div>
              ))}
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
                    if (e.key === "Enter") send();
                  }}
                  placeholder="enter enquiries here...."
                  className="w-full h-14 rounded-full border border-slate-200 bg-white px-6 pr-14 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={send}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center transition"
                  aria-label="Send"
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
