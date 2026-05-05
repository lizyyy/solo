import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API 错误:', error)
    return Promise.reject(error)
  }
)

export const healthApi = {
  check: () => api.get('/health')
}

export const importApi = {
  inspection: (formData) => api.post('/import/inspection', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  currentLog: (formData) => api.post('/import/current-log', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  repair: (formData) => api.post('/import/repair', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  maintenance: (formData) => api.post('/import/maintenance', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const riskApi = {
  getList: (params) => api.get('/risk', { params }),
  getById: (id) => api.get(`/risk/${id}`),
  detect: (data) => api.post('/risk/detect', data),
  updateJudgment: (id, data) => api.put(`/risk/${id}/judgment`, data),
  updateStatus: (id, data) => api.put(`/risk/${id}/status`, data),
  getStatistics: () => api.get('/risk/statistics/overview')
}

export const escalatorApi = {
  getList: (params) => api.get('/escalator', { params }),
  getStations: () => api.get('/escalator/stations'),
  getByCode: (code) => api.get(`/escalator/${code}`)
}

export const maintenanceApi = {
  getList: (params) => api.get('/maintenance', { params }),
  getById: (id) => api.get(`/maintenance/${id}`),
  update: (id, data) => api.put(`/maintenance/${id}`, data)
}

export const repairApi = {
  getList: (params) => api.get('/repair', { params }),
  getById: (id) => api.get(`/repair/${id}`),
  update: (id, data) => api.put(`/repair/${id}`, data)
}

export const inspectionApi = {
  getList: (params) => api.get('/inspection', { params }),
  getById: (id) => api.get(`/inspection/${id}`)
}

export const currentLogApi = {
  getList: (params) => api.get('/current-log', { params }),
  getStatistics: (escalatorCode, params) => api.get(`/current-log/statistics/${escalatorCode}`, { params })
}

export const exportApi = {
  getHandoverReportMarkdown: (params) => api.get('/export/handover-report/markdown', { params, responseType: 'blob' }),
  getHandoverReportJson: (params) => api.get('/export/handover-report/json', { params }),
  getEscalatorDetailJson: (escalatorCode) => api.get(`/export/escalator-detail/json/${escalatorCode}`)
}

export default api
