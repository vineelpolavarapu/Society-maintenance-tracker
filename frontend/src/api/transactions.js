import { apiClient } from './client'

export const getTransactions = (cycle) =>
  apiClient.get('/transactions', { params: cycle ? { cycle } : {} })

export const createTransaction = (data) =>
  apiClient.post('/transactions', data)

export const reverseTransaction = (id, correction) =>
  apiClient.post(`/transactions/${id}/reverse`, correction)
