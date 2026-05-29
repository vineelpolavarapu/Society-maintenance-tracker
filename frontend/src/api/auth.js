import { apiClient } from './client'

export const login = (contact, password) =>
  apiClient.post('/auth/login', { contact, password })

export const register = (data) =>
  apiClient.post('/auth/register', data)

export const getMe = () =>
  apiClient.get('/auth/me')
