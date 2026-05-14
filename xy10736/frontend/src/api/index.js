import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const statsAPI = {
  getStats: () => api.get('/stats'),
  getTrend: (days) => api.get('/detection/stats/trend', { params: { days } }),
  getByPage: () => api.get('/detection/stats/bypage')
}

export const trackingAPI = {
  getPoints: (params) => api.get('/tracking/points', { params }),
  createPoint: (data) => api.post('/tracking/points', data),
  updatePoint: (id, data) => api.put(`/tracking/points/${id}`, data),
  getEvents: (params) => api.get('/tracking/events', { params }),
  sendEvent: (data) => api.post('/tracking/event', data)
}

export const sessionAPI = {
  getSessions: (params) => api.get('/session', { params }),
  startSession: (data) => api.post('/session/start', data),
  completeSession: (id) => api.post(`/session/${id}/complete`),
  getDetail: (sessionId) => api.get(`/session/${sessionId}/detail`)
}

export const detectionAPI = {
  getDetections: (params) => api.get('/detection', { params }),
  confirm: (id, data) => api.post(`/detection/${id}/confirm`, data),
  resolve: (id, data) => api.post(`/detection/${id}/resolve`, data),
  dismiss: (id, data) => api.post(`/detection/${id}/dismiss`, data)
}

export const reportAPI = {
  getAcceptance: (sessionId) => api.get(`/report/acceptance/${sessionId}`),
  exportExcel: (sessionId) => window.open(`/api/report/acceptance/${sessionId}/excel`, '_blank')
}

export const versionAPI = {
  getVersions: () => api.get('/version'),
  create: (data) => api.post('/version', data),
  approve: (id, data) => api.post(`/version/${id}/approve`, data),
  reject: (id, data) => api.post(`/version/${id}/reject`, data)
}

export default api
