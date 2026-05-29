import { apiClient } from './client'

export const getRegistrations = () => apiClient.get('/registrations')

export const approveRegistration = (id, role = 'resident', can_approve = false) =>
  apiClient.post(`/registrations/${id}/approve`, null, {
    params: { role, can_approve },
  })

export const rejectRegistration = (id) =>
  apiClient.post(`/registrations/${id}/reject`)
