import { apiClient } from './client'

export const recordPayment = (data) => apiClient.post('/payments', data)
