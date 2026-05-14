import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000
})

export const geofenceApi = {
  list: () => api.get('/geofences'),
  get: (id) => api.get(`/geofences/${id}`),
  create: (data) => api.post('/geofences', data),
  update: (id, data) => api.put(`/geofences/${id}`, data),
  delete: (id) => api.delete(`/geofences/${id}`)
}

export const deviceApi = {
  list: () => api.get('/devices'),
  get: (id) => api.get(`/devices/${id}`),
  create: (data) => api.post('/devices', data)
}

export const positionApi = {
  list: (deviceId) => api.get(`/positions/device/${deviceId}`),
  add: (data) => api.post('/positions', data)
}

export const alertApi = {
  list: (params) => api.get('/alerts', { params }),
  get: (id) => api.get(`/alerts/${id}`),
  create: (data) => api.post('/alerts', data),
  update: (id, data) => api.put(`/alerts/${id}`, data),
  correct: (data) => api.post('/alerts/manual-correction', data)
}

export const trajectoryApi = {
  playback: (data) => api.post('/trajectory/playback', data),
  trace: (data) => api.post('/trajectory/trace', data),
  generateReport: (data) => api.post('/trajectory/reports', data),
  reports: () => api.get('/trajectory/reports')
}

export const configApi = {
  getStrategies: () => api.get('/notification-strategies'),
  createStrategy: (data) => api.post('/notification-strategies', data),
  getFilters: () => api.get('/false-alarm-filters'),
  createFilter: (data) => api.post('/false-alarm-filters', data)
}

export const exportApi = {
  export: (data) => api.post('/export', data, {
    responseType: 'blob'
  })
}

export default api