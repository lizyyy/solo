import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const recordsApi = {
  list: (params) => api.get('/records', { params }),
  get: (id) => api.get(`/records/${id}`),
  create: (data) => api.post('/records', data),
  update: (id, data) => api.put(`/records/${id}`, data),
  confirm: (id, confirmedBy) => api.post(`/records/${id}/confirm?confirmed_by=${confirmedBy}`),
  versions: (id) => api.get(`/records/${id}/versions`),
  rollback: (id, versionNumber, rolledBackBy) => 
    api.post(`/records/${id}/rollback/${versionNumber}?rolled_back_by=${rolledBackBy}`),
  analyzeError: (id) => api.post(`/records/${id}/analyze-error`),
}

export const savedQueriesApi = {
  list: () => api.get('/saved-queries'),
  create: (data) => api.post('/saved-queries', data),
  delete: (id) => api.delete(`/saved-queries/${id}`)
}

export const exportApi = {
  excel: (data) => api.post('/export/excel', data, { responseType: 'blob' }),
  summary: (params) => api.get('/export/summary', { params })
}

export const idempotencyApi = {
  check: (key) => api.get(`/idempotency/check/${key}`),
  generate: (data) => api.post('/idempotency/generate', data)
}

export default api
