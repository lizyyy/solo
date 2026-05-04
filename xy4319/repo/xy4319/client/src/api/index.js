import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default {
  health: () => api.get('/health'),
  
  getSystemInfo: () => api.get('/system/info'),
  
  patients: {
    getAll: (params = {}) => api.get('/patients', { params }),
    get: (id) => api.get(`/patients/${id}`),
    create: (data) => api.post('/patients', data),
    update: (id, data) => api.put(`/patients/${id}`, data),
    delete: (id) => api.delete(`/patients/${id}`),
    batch: (patients) => api.post('/patients/batch', { patients })
  },
  
  departments: {
    getAll: () => api.get('/departments'),
    getCapacity: (id) => api.get(`/departments/${id}/capacity`)
  },
  
  beds: {
    getAll: (params = {}) => api.get('/beds', { params })
  },
  
  transfers: {
    getAll: (params = {}) => api.get('/transfers', { params }),
    create: (data) => api.post('/transfers', data),
    update: (id, data) => api.put(`/transfers/${id}`, data),
    reorder: (transfers) => api.post('/transfers/reorder', { transfers })
  },
  
  ambulances: {
    getAll: () => api.get('/ambulances')
  },
  
  logs: {
    getAll: (params = {}) => api.get('/logs', { params }),
    getStats: (params = {}) => api.get('/logs/stats', { params })
  },
  
  rules: {
    check: () => api.post('/rules/check'),
    getTriageSuggestion: (patient) => api.post('/rules/triage-suggestion', { patient })
  },
  
  export: {
    report: () => '/api/export/report',
    incidents: () => '/api/export/incidents',
    patients: () => '/api/export/patients'
  },
  
  sampleData: {
    create: () => api.post('/sample-data'),
    clear: () => api.delete('/sample-data')
  }
}
