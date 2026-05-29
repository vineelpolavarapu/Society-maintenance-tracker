import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { register as apiRegister } from '../api/auth'
import { apiClient } from '../api/client'

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    flat_no: '',
    building_name: '',
    claimed_unit_id: '',
  })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: units } = useQuery({
    queryKey: ['units-public'],
    queryFn: () => apiClient.get('/units/public').then(r => r.data).catch(() => []),
    retry: false,
  })

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function clientValidate() {
    if (!form.name.trim()) return 'Full name is required'
    if (!form.email && !form.phone) return 'Provide either an email or a phone number'
    if (form.password.length < 6) return 'Password must be at least 6 characters'
    if (form.password !== form.confirm_password) return 'Passwords do not match'
    if (!form.flat_no.trim()) return 'Door / Flat number is required'
    return ''
  }

  async function submit(e) {
    e.preventDefault()
    setErr(''); setOk('')
    const v = clientValidate()
    if (v) { setErr(v); return }

    setLoading(true)
    try {
      await apiRegister({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        password: form.password,
        confirm_password: form.confirm_password,
        flat_no: form.flat_no.trim() || null,
        building_name: form.building_name.trim() || null,
        claimed_unit_id: form.claimed_unit_id ? parseInt(form.claimed_unit_id) : null,
      })
      setOk('Registration submitted! The Secretary will review and approve your account. You will be able to sign in once approved.')
      setForm({
        name: '', email: '', phone: '', password: '', confirm_password: '',
        flat_no: '', building_name: '', claimed_unit_id: '',
      })
    } catch (ex) {
      const detail = ex.response?.data?.detail
      if (Array.isArray(detail)) {
        setErr(detail.map(d => d.msg).join(', '))
      } else {
        setErr(detail ?? 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card register-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div className="glyph" style={{ background: '#2a2520', color: '#c9a96a', width: 48, height: 48, borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 600, border: '1px solid #c9a96a', fontFamily: 'Cormorant Garamond, Georgia, serif', letterSpacing: '1px' }}>A</div>
          <div>
            <h1 style={{ marginBottom: 0 }}>Arihant Card Master Enclave</h1>
            <p style={{ marginBottom: 0, marginTop: 2 }}>Resident Registration</p>
          </div>
        </div>
        <p style={{ marginBottom: 18 }}>
          Fill in your details below. Your account will become active after the Secretary verifies and approves your registration.
        </p>

        {err && <div className="err-msg">{err}</div>}
        {ok && <div className="ok-msg">{ok}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Full Name <span className="req">*</span></label>
            <input value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="e.g. Ramesh Kumar" required />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                placeholder="you@email.com" />
            </div>
            <div className="field">
              <label>Phone</label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                placeholder="9876543210" pattern="[0-9+\- ]{6,20}" />
            </div>
          </div>
          <small className="field-hint">Provide at least one — email or phone.</small>

          <div className="field-row">
            <div className="field">
              <label>Create Password <span className="req">*</span></label>
              <input type="password" value={form.password} onChange={e => update('password', e.target.value)}
                placeholder="Min. 6 characters" required minLength={6} />
            </div>
            <div className="field">
              <label>Confirm Password <span className="req">*</span></label>
              <input type="password" value={form.confirm_password}
                onChange={e => update('confirm_password', e.target.value)}
                placeholder="Re-enter password" required minLength={6} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Door / Flat Number <span className="req">*</span></label>
              <input value={form.flat_no} onChange={e => update('flat_no', e.target.value)}
                placeholder="e.g. A-203, Villa 14" required />
            </div>
            <div className="field">
              <label>Building / Block Name</label>
              <input value={form.building_name} onChange={e => update('building_name', e.target.value)}
                placeholder="e.g. Sapphire Block, Tower B" />
            </div>
          </div>

          <div className="field">
            <label>Your Unit on Record (optional)</label>
            <select value={form.claimed_unit_id}
              onChange={e => update('claimed_unit_id', e.target.value)}>
              <option value="">— select a unit (if you know it) —</option>
              {(units ?? []).map(u => (
                <option key={u.id} value={u.id}>{u.identifier} ({u.type})</option>
              ))}
            </select>
            <small className="field-hint">If your unit isn&apos;t listed yet, leave this blank — the Secretary will assign it during approval.</small>
          </div>

          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>

        <div className="auth-link">
          Already a resident? <Link to="/login-user">Sign in</Link>
          &nbsp;|&nbsp; <Link to="/">&larr; Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
