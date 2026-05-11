import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const plotApi = {
  getAll: () => api.get('/plots'),
  getById: (id) => api.get(`/plots/${id}`),
  create: (data) => api.post('/plots', data),
  update: (id, data) => api.put(`/plots/${id}`, data),
  delete: (id) => api.delete(`/plots/${id}`)
}

export const gradeApi = {
  getAll: () => api.get('/grades'),
  create: (data) => api.post('/grades', data),
  update: (id, data) => api.put(`/grades/${id}`, data),
  delete: (id) => api.delete(`/grades/${id}`)
}

export const lossReasonApi = {
  getAll: () => api.get('/loss-reasons'),
  create: (data) => api.post('/loss-reasons', data),
  update: (id, data) => api.put(`/loss-reasons/${id}`, data),
  delete: (id) => api.delete(`/loss-reasons/${id}`)
}

export const managerApi = {
  getAll: () => api.get('/managers'),
  create: (data) => api.post('/managers', data),
  update: (id, data) => api.put(`/managers/${id}`, data),
  delete: (id) => api.delete(`/managers/${id}`)
}

export const harvestTaskApi = {
  getAll: () => api.get('/harvest-tasks'),
  getById: (id) => api.get(`/harvest-tasks/${id}`),
  create: (data) => api.post('/harvest-tasks', data),
  update: (id, data) => api.put(`/harvest-tasks/${id}`, data),
  delete: (id) => api.delete(`/harvest-tasks/${id}`)
}

export const batchApi = {
  getAll: () => api.get('/batches'),
  getById: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  update: (id, data) => api.put(`/batches/${id}`, data),
  delete: (id) => api.delete(`/batches/${id}`),
  getHistory: (id) => api.get(`/batches/${id}/history`),
  adjustGrade: (id, data) => api.post(`/batches/${id}/adjust-grade`, data)
}

export const inspectionApi = {
  getAll: () => api.get('/inspections'),
  getByBatch: (batchId) => api.get(`/inspections/batch/${batchId}`),
  create: (data) => api.post('/inspections', data),
  update: (id, data) => api.put(`/inspections/${id}`, data)
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard'),
  getAvailableStock: () => api.get('/stock/available'),
  getQuarantinedStock: () => api.get('/stock/quarantined'),
  exportReport: (params) => api.get('/reports/harvest/export', { 
    params,
    responseType: 'blob' 
  })
}

export default api
