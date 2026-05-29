import { useAuth } from '../contexts/AuthContext'

export default function TopBar() {
  const { user, logout } = useAuth()

  const roleLabel = user?.role === 'treasurer'
    ? 'Treasurer · can record money'
    : user?.can_approve
    ? 'Secretary · approves members'
    : 'Member · read-only'

  return (
    <div className="topbar">
      <div className="brand">
        <div className="glyph">A</div>
        <div>
          <span className="brand-title">Arihant Card Master Enclave</span>
          <small>Members&apos; Portal</small>
        </div>
      </div>
      <div className="spacer" />
      <div className="who">
        <b>{user?.name ?? '—'}</b>
        <span>{roleLabel}</span>
      </div>
      <button className="btn topbar-signout" onClick={logout}>
        Sign out
      </button>
    </div>
  )
}
