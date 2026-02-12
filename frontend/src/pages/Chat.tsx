import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string

export default function Chat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <div>
      <h2>Chat</h2>
      <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, height: 420, overflow: 'auto' }}>
        {messages.length === 0 && <div style={{ opacity: 0.7 }}>Start chatting. (RAG+LLM is implemented in backend)</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0' }}>
            <b>{m.role === 'user' ? 'You' : 'Assistant'}:</b> {m.content}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          style={{ flex: 1 }}
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          disabled={loading}
        />
        <button onClick={send} disabled={loading}>Send</button>
      </div>

      {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
    </div>
  )
}
