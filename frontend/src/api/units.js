import { apiClient } from './client'

export const getUnits = () => apiClient.get('/units')

export const createUnit = (data) => apiClient.post('/units', data)

export const getUnitDues = (unitId) => apiClient.get(`/units/${unitId}/dues`)

export const getUnitHistory = (unitId, months = 24) =>
  apiClient.get(`/units/${unitId}/history`, { params: { months } })
