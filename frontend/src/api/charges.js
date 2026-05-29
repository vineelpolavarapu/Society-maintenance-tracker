import { apiClient } from './client'

export const getCharges = (params) => apiClient.get('/charges', { params })

export const raiseBulkCharges = (data) => apiClient.post('/charges/bulk', data)
