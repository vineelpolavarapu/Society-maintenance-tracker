import { useNavigate, Link } from 'react-router-dom'

export default function LoginHome() {
  const nav = useNavigate()

  return (
    <div className="login-home">
      <div className="login-home-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <div className="glyph" style={{ background: '#2a2520', color: '#c9a96a', width: 56, height: 56, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 600, border: '1px solid #c9a96a', fontFamily: 'Cormorant Garamond, Georgia, serif', letterSpacing: '1px' }}>A</div>
          <div>
            <h1 style={{ marginBottom: 0, fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 24, fontWeight: 600, letterSpacing: '.3px', color: 'var(--ink)' }}>Arihant Card Master Enclave</h1>
            <p style={{ marginBottom: 0, marginTop: 4, fontSize: 10, color: 'var(--accent-deep)', letterSpacing: '2.4px', textTransform: 'uppercase', fontWeight: 600 }}>Members&apos; Portal</p>
          </div>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: 28, color: '#333' }}>Select Your Role</h2>

        <div className="role-grid role-grid-4">
          <button
            className="role-card admin"
            onClick={() => nav('/login-admin')}
          >
            <div className="role-icon">&#x1F4BC;</div>
            <h3>Admin</h3>
            <p>Treasurer Access</p>
            <span className="role-desc">Full administrative control</span>
          </button>

          <button
            className="role-card secretary"
            onClick={() => nav('/login-secretary')}
          >
            <div className="role-icon">&#x1F4DD;</div>
            <h3>Secretary</h3>
            <p>Committee Member</p>
            <span className="role-desc">Approvals &amp; coordination</span>
          </button>

          <button
            className="role-card president"
            onClick={() => nav('/login-president')}
          >
            <div className="role-icon">&#x1F3DB;</div>
            <h3>President</h3>
            <p>Oversight Access</p>
            <span className="role-desc">Society leadership view</span>
          </button>

          <button
            className="role-card user"
            onClick={() => nav('/login-user')}
          >
            <div className="role-icon">&#x1F3E0;</div>
            <h3>User</h3>
            <p>Resident Access</p>
            <span className="role-desc">View your dues &amp; payments</span>
          </button>
        </div>

        <div className="role-foot">
          New resident? <Link to="/register">Register here</Link> &nbsp;|&nbsp; <Link to="/">&larr; Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
