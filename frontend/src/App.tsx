import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Chat from './pages/Chat'
import Upload from './pages/Upload'

function Protected({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>
  return authed ? children : <Navigate to="/login" replace />
}

export default function App() {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Link to="/" style={{ fontWeight: 700, textDecoration: 'none' }}>DocuPilot</Link>
        <nav style={{ display: 'flex', gap: 10 }}>
          <Link to="/chat">Chat</Link>
          <Link to="/upload">Upload</Link>
        </nav>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/chat" element={<Protected><Chat /></Protected>} />
        <Route path="/upload" element={<Protected><Upload /></Protected>} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </div>
  )
}
