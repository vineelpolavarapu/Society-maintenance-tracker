import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { login as apiLogin, getMe } from '../api/auth'
import { apiClient } from '../api/client'

export default function CoAdminLogin() {
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

      // Verify user is committee member
      if (user.role !== 'committee') {
        setErr('Co-Admin access required. Please log in with committee credentials.')
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
    <div className="auth-wrap coadmin-login">
      <div className="auth-card coadmin-card">
        <div className="role-badge coadmin">Co-Admin</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="glyph" style={{ background: '#0066cc', color: '#fff', width: 36, height: 36, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700 }}>AE</div>
          <div>
            <h1 style={{ marginBottom: 0 }}>Arihant Enclave</h1>
            <p style={{ marginBottom: 0, marginTop: 2 }}>Secretary Portal</p>
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
          <button type="submit" className="btn primary coadmin-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Co-Admin Sign in'}
          </button>
        </form>
        <div className="auth-link">
          <Link to="/">← Back to Role Selection</Link>
        </div>
      </div>
    </div>
  )
}
