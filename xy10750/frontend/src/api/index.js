import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const preferenceApi = {
  create: (data) => api.post('/preferences', data),
  update: (id, data) => api.put(`/preferences/${id}`, data),
  rollback: (id, versionNumber, changedBy) => 
    api.post(`/preferences/${id}/rollback/${versionNumber}`, null, {
      params: { changed_by: changedBy }
    }),
  getList: (params) => api.get('/preferences', { params }),
  getById: (id) => api.get(`/preferences/${id}`),
  getVersions: (id) => api.get(`/preferences/${id}/versions`)
}

export const receiptApi = {
  create: (data) => api.post('/receipts', data),
  update: (id, data) => api.put(`/receipts/${id}`, data),
  getList: (params) => api.get('/receipts', { params }),
  getAbnormal: (params) => api.get('/receipts/abnormal', { params })
}

export const retryApi = {
  create: (data) => api.post('/retry-records', data),
  confirm: (id, data) => api.post(`/retry-records/${id}/confirm`, data),
  execute: (id) => api.post(`/retry-records/${id}/execute`),
  getList: (params) => api.get('/retry-records', { params })
}

export const exportApi = {
  create: (data) => api.post('/exports', data),
  getList: (params) => api.get('/exports', { params }),
  download: (exportId) => window.open(`/api/exports/${exportId}/download`)
}

export default api