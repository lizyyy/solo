import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const statisticsApi = {
  getStatistics: () => api.get('/statistics')
}

export const templateApi = {
  list: (params) => api.get('/templates', { params }),
  get: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  getVersions: (id) => api.get(`/templates/${id}/versions`),
  getDiff: (id, versionOld, versionNew) => 
    api.get(`/templates/${id}/diff`, { params: { version_old: versionOld, version_new: versionNew } })
}

export const batchApi = {
  list: (params) => api.get('/batches', { params }),
  get: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  getEmails: (id, params) => api.get(`/batches/${id}/emails`, { params }),
  getValidations: (id, onlyInvalid) => 
    api.get(`/batches/${id}/validations`, { params: { only_invalid: onlyInvalid } }),
  recalculateValidations: (id) => api.post(`/batches/${id}/recalculate-validations`),
  advanceStage: (id) => api.post(`/batches/${id}/advance-stage`),
  intercept: (id, reason) => api.post(`/batches/${id}/intercept`, null, { params: { reason } }),
  compensate: (id, data) => api.post(`/batches/${id}/compensate`, data),
  manualReview: (id) => api.post(`/batches/${id}/manual-review`),
  getLogs: (id) => api.get(`/batches/${id}/logs`),
  export: (id, format) => 
    api.get(`/batches/${id}/export`, { params: { format }, responseType: 'blob' })
}

export const approvalApi = {
  list: (params) => api.get('/approvals', { params }),
  create: (data) => api.post('/approvals', data),
  action: (id, data) => api.post(`/approvals/${id}/action`, data)
}

export default api
