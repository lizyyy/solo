import axios from 'axios'
import { ElMessage } from 'element-plus'

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
    const message = error.response?.data?.message || error.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export const suppliersAPI = {
  list: (params) => api.get('/suppliers', { params }),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`)
}

export const materialsAPI = {
  list: (params) => api.get('/materials', { params }),
  get: (id) => api.get(`/materials/${id}`),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id) => api.delete(`/materials/${id}`),
  categories: () => api.get('/materials/categories'),
  stats: () => api.get('/materials/stats')
}

export const materialBatchesAPI = {
  list: (params) => api.get('/material-batches', { params }),
  get: (id) => api.get(`/material-batches/${id}`),
  create: (data) => api.post('/material-batches', data),
  update: (id, data) => api.put(`/material-batches/${id}`, data),
  delete: (id) => api.delete(`/material-batches/${id}`),
  trace: (id) => api.get(`/material-batches/trace/${id}`),
  stats: () => api.get('/material-batches/stats')
}

export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
}

export const recipesAPI = {
  list: (params) => api.get('/recipes', { params }),
  get: (id) => api.get(`/recipes/${id}`),
  getByProduct: (productId) => api.get(`/recipes/product/${productId}`),
  create: (data) => api.post('/recipes', data),
  update: (id, data) => api.put(`/recipes/${id}`, data),
  delete: (id) => api.delete(`/recipes/${id}`),
  validateIngredient: (data) => api.post('/recipes/validate-ingredient', data)
}

export const productionAPI = {
  list: (params) => api.get('/production', { params }),
  get: (id) => api.get(`/production/${id}`),
  create: (data) => api.post('/production', data),
  update: (id, data) => api.put(`/production/${id}`, data),
  delete: (id) => api.delete(`/production/${id}`),
  checkFeasibility: (data) => api.post('/production/check-feasibility', data),
  complete: (id) => api.post(`/production/${id}/complete`)
}

export const customersAPI = {
  list: (params) => api.get('/customers', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
}

export const ordersAPI = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  calculateQuote: (data) => api.post('/orders/calculate-quote', data),
  stats: () => api.get('/orders/stats')
}

export const dashboardAPI = {
  overview: () => api.get('/dashboard/overview'),
  expiring: (days) => api.get('/dashboard/expiring', { params: { days } }),
  lowStock: (threshold) => api.get('/dashboard/low-stock', { params: { threshold } }),
  negativeMargin: () => api.get('/dashboard/negative-margin'),
  traceMaterialBatch: (id) => api.get(`/dashboard/trace-material-batch/${id}`)
}

export const importAPI = {
  templates: () => api.get('/import/templates'),
  materials: (formData) => api.post('/import/materials', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  materialBatches: (formData) => api.post('/import/material-batches', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const exportAPI = {
  traceReport: (batchId, format) => api.get(`/export/trace/${batchId}`, {
    params: { format },
    responseType: format === 'html' ? 'blob' : 'text'
  }),
  ordersReport: (format) => api.get('/export/orders', {
    params: { format },
    responseType: format === 'html' ? 'blob' : 'text'
  }),
  dashboardReport: (format) => api.get('/export/dashboard', {
    params: { format },
    responseType: format === 'html' ? 'blob' : 'text'
  })
}

export default api
