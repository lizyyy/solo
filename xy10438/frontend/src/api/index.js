import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error || error.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

export const adjustmentsAPI = {
  list: (params) => api.get('/adjustments', { params }),
  get: (id) => api.get(`/adjustments/${id}`),
  create: (data) => api.post('/adjustments', data),
  update: (id, data) => api.put(`/adjustments/${id}`, data),
  publish: (id) => api.post(`/adjustments/${id}/publish`)
}

export const storeTasksAPI = {
  list: (params) => api.get('/store-tasks', { params }),
  get: (id) => api.get(`/store-tasks/${id}`),
  confirm: (id, data) => api.post(`/store-tasks/${id}/confirm`, data),
  reportException: (id, data) => api.post(`/store-tasks/${id}/exception`, data),
  getDashboardSummary: (params) => api.get('/store-tasks/dashboard/summary', { params }),
  exportPriceDifferences: (params) => api.get('/store-tasks/export/price-differences', { 
    params, 
    responseType: 'blob' 
  })
}

export const exceptionsAPI = {
  list: (params) => api.get('/exceptions', { params }),
  resolve: (id, data) => api.put(`/exceptions/${id}/resolve`, data),
  getStatistics: (params) => api.get('/exceptions/statistics', { params })
}

export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data)
}

export const storesAPI = {
  list: (params) => api.get('/stores', { params }),
  get: (id) => api.get(`/stores/${id}`),
  create: (data) => api.post('/stores', data)
}

export const regionsAPI = {
  list: () => api.get('/regions'),
  get: (id) => api.get(`/regions/${id}`),
  create: (data) => api.post('/regions', data)
}

export default api
