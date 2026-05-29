import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { login as apiLogin, getMe } from '../api/auth'
import { apiClient } from '../api/client'

export default function UserLogin() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const { data: { access_token } } = await apiLogin(contact, password)
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      const { data: user } = await getMe()

      // Verify user is resident
      if (user.role !== 'resident') {
        setErr('User access required. Please log in with resident credentials.')
        return
      }

      login(access_token, user)
      nav('/expenses')
    } catch (ex) {
      setErr(ex.response?.data?.detail ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap user-login">
      <div className="auth-card user-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="glyph" style={{ background: '#2a2520', color: '#c9a96a', width: 44, height: 44, borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, border: '1px solid #c9a96a', letterSpacing: '1.2px' }}>A</div>
          <div>
            <h1 style={{ marginBottom: 0 }}>Arihant Card Master Enclave</h1>
            <p style={{ marginBottom: 0, marginTop: 2 }}>Resident Portal</p>
          </div>
        </div>
        {err && <div className="err-msg">{err}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Email or Phone</label>
            <input type="text" value={contact} onChange={e => setContact(e.target.value)}
              placeholder="you@email.com or 9876543210" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn primary user-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'User Sign in'}
          </button>
        </form>
        <div className="auth-link">
          New resident? <Link to="/register">Register here</Link> &nbsp;|&nbsp; <Link to="/">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
