import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import LoginHome from './pages/LoginHome'
import AdminLogin from './pages/AdminLogin'
import SecretaryLogin from './pages/SecretaryLogin'
import PresidentLogin from './pages/PresidentLogin'
import UserLogin from './pages/UserLogin'
import Login from './pages/Login'
import Register from './pages/Register'
import ExpenseDashboard from './pages/ExpenseDashboard'
import MaintenanceDashboard from './pages/MaintenanceDashboard'
import MyUnit from './pages/MyUnit'
import Approvals from './pages/Approvals'
import Units from './pages/Units'

function ProtectedLayout() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <>
      <TopBar />
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/expenses" element={<ExpenseDashboard />} />
            <Route path="/maintenance" element={<MaintenanceDashboard />} />
            <Route path="/my-unit" element={<MyUnit />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/units" element={<Units />} />
            <Route path="*" element={<Navigate to="/expenses" replace />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/expenses" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><LoginHome /></PublicRoute>} />
          <Route path="/signin" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/login-admin" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/login-secretary" element={<PublicRoute><SecretaryLogin /></PublicRoute>} />
          <Route path="/login-president" element={<PublicRoute><PresidentLogin /></PublicRoute>} />
          <Route path="/login-user" element={<PublicRoute><UserLogin /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
