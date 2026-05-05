import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const experimentApi = {
  getAll: () => api.get('/experiments'),
  
  getById: (id) => api.get(`/experiments/${id}`),
  
  create: (config) => api.post('/experiments', config),
  
  run: (id) => api.post(`/experiments/${id}/run`),
  
  getTimeline: (id, model = null) => {
    const params = model ? { params: { model } } : {}
    return api.get(`/experiments/${id}/timeline`, params)
  },
  
  exportJSON: (id) => api.get(`/experiments/${id}/export/json`, { responseType: 'blob' }),
  
  exportMarkdown: (id) => api.get(`/experiments/${id}/export/markdown`, { responseType: 'blob' }),
  
  delete: (id) => api.delete(`/experiments/${id}`),
  
  validate: (config) => api.post('/experiments/validate', config)
}

export const seedApi = {
  getAll: () => api.get('/experiments/seeds')
}

export const healthApi = {
  check: () => api.get('/health'),
  getInfo: () => api.get('/info')
}

export default api
