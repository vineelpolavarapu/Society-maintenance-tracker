import { apiClient } from './client'

export const getExpensesDashboard = (cycle) =>
  apiClient.get('/dashboard/expenses', { params: { cycle } })

export const getMaintenanceDashboard = (cycle) =>
  apiClient.get('/dashboard/maintenance', { params: { cycle } })
