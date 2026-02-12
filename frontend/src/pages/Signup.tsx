import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link, useNavigate } from 'react-router-dom'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return setError(error.message)

    setInfo('Signup successful. If email confirmation is enabled, please confirm then log in.')
    // If confirmation disabled, user may be logged in automatically:
    const { data } = await supabase.auth.getSession()
    if (data.session) navigate('/chat')
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h2>Sign up</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Create account</button>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
        {info && <div style={{ color: 'green' }}>{info}</div>}
      </form>
      <p style={{ marginTop: 12 }}>
        Have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
