import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Sidebar() {
  const { user } = useAuth()
  const isTreasurer = user?.role === 'treasurer'
  const canApprove = user?.can_approve

  return (
    <nav className="nav">
      <div className="group">Finance</div>
      <NavLink to="/expenses" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
        <span className="ic">₹</span> Expenses
      </NavLink>
      <NavLink to="/maintenance" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
        <span className="ic">⊟</span> Maintenance
      </NavLink>
      <div className="group">My Account</div>
      <NavLink to="/my-unit" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
        <span className="ic">⌂</span> My Unit
      </NavLink>
      {(canApprove || isTreasurer) && (
        <>
          <div className="group">Administration</div>
          {canApprove && (
            <NavLink to="/approvals" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
              <span className="ic">✓</span> Approvals <span className="tag">Secretary</span>
            </NavLink>
          )}
          {isTreasurer && (
            <NavLink to="/units" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
              <span className="ic">⊞</span> Units
            </NavLink>
          )}
        </>
      )}
    </nav>
  )
}
