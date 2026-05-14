import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const audioApi = {
  list: (params) => api.get('/audio/', { params }),
  get: (id) => api.get(`/audio/${id}`),
  create: (data) => api.post('/audio/', data),
  update: (id, data) => api.put(`/audio/${id}`, data)
}

export const qualityApi = {
  processFlow: (data) => api.post('/quality-flow/', data)
}

export const timelineApi = {
  get: (id) => api.get(`/timeline/${id}`)
}

export const approvalApi = {
  get: (id) => api.get(`/approvals/${id}`)
}

export const statisticsApi = {
  get: (days) => api.get('/statistics/', { params: { days } })
}

export const exportApi = {
  list: () => api.get('/exports/'),
  export: (data) => api.post('/export/', data),
  download: (filename) => `/api/exports/${filename}`
}

export default api
