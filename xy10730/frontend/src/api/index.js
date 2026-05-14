import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const serviceAPI = {
  getServices: () => api.get('/services'),
  getService: (id) => api.get(`/services/${id}`),
  createService: (data) => api.post('/services', data),
  updateService: (id, data) => api.put(`/services/${id}`, data)
}

export const healthRecordAPI = {
  getRecords: (params) => api.get('/health-records', { params }),
  getRecord: (id) => api.get(`/health-records/${id}`),
  createCheck: (data) => api.post('/health-check', data),
  review: (id, data) => api.post(`/health-records/${id}/review`, data),
  confirmRecovery: (id, data) => api.post(`/health-records/${id}/confirm-recovery`, data),
  export: (params) => api.get('/health-records/export', { params, responseType: 'blob' })
}

export const dutyReportAPI = {
  getReports: (params) => api.get('/duty-reports', { params }),
  createReport: (data) => api.post('/duty-reports', data),
  handleReport: (id, data) => api.post(`/duty-reports/${id}/handle`, data)
}

export const statisticsAPI = {
  getStats: () => api.get('/statistics')
}

export default api
