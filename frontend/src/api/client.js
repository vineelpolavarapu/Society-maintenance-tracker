import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Routes that don't require auth — never bounce the user from one of these to /login.
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signin',
  '/login-admin',
  '/login-secretary',
  '/login-president',
  '/login-user',
  '/register',
]

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname
      const isPublic = PUBLIC_PATHS.includes(path)
      // Only bounce to /login if we actually had a token AND we're not already on a public page
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (hadToken && !isPublic) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)
