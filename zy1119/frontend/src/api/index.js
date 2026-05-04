import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats')
}

export const productApi = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getByCategory: (category) => api.get('/products', { params: { category } })
}

export const groupBatchApi = {
  getAll: (params) => api.get('/group-batches', { params }),
  getById: (id) => api.get(`/group-batches/${id}`),
  create: (data) => api.post('/group-batches', data),
  update: (id, data) => api.put(`/group-batches/${id}`, data),
  updateStatus: (id, status) => api.put(`/group-batches/${id}/status`, { status })
}

export const orderApi = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  pickup: (id) => api.put(`/orders/${id}/pickup`),
  updatePickupSlot: (id, pickup_slot_id) => api.put(`/orders/${id}/pickup-slot`, { pickup_slot_id }),
  allocateInventory: (id) => api.put(`/orders/${id}/allocate`)
}

export const inventoryApi = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  getStats: () => api.get('/inventory/stats'),
  getExpiring: (days) => api.get('/inventory/expiring', { params: { days } }),
  getSummary: (product_id) => api.get('/inventory/summary', { params: { product_id } }),
  assignFreezer: (id, freezer_id, quantity) => api.put(`/inventory/${id}/assign-freezer`, { freezer_id, quantity })
}

export const freezerApi = {
  getAll: (params) => api.get('/freezers', { params }),
  getById: (id) => api.get(`/freezers/${id}`),
  create: (data) => api.post('/freezers', data),
  update: (id, data) => api.put(`/freezers/${id}`, data),
  updateStatus: (id, status) => api.put(`/freezers/${id}/status`, { status }),
  getStats: () => api.get('/freezers/summary')
}

export const pickupSlotApi = {
  getAll: (params) => api.get('/pickup-slots', { params }),
  getById: (id) => api.get(`/pickup-slots/${id}`),
  getByDate: (date) => api.get('/pickup-slots', { params: { date } }),
  create: (data) => api.post('/pickup-slots', data),
  update: (id, data) => api.put(`/pickup-slots/${id}`, data),
  updateStatus: (id, status) => api.put(`/pickup-slots/${id}/status`, { status }),
  getAvailable: (date) => api.get('/pickup-slots/available', { params: { date } }),
  getOverloaded: () => api.get('/pickup-slots/overloaded'),
  getAlternatives: (id, count) => api.get(`/pickup-slots/${id}/alternatives`, { params: { count } })
}

export const exceptionApi = {
  getAll: (params) => api.get('/exceptions', { params }),
  getById: (id) => api.get(`/exceptions/${id}`),
  create: (data) => api.post('/exceptions', data),
  resolve: (id, data) => api.put(`/exceptions/${id}/resolve`, data),
  updateStatus: (id, status) => api.put(`/exceptions/${id}/status`, { status }),
  getSuggestions: (id) => api.get(`/exceptions/${id}/suggestions`),
  getStats: () => api.get('/exceptions/stats')
}

export const exportApi = {
  exportPickupList: (date) => api.get('/export/pickup-list', { params: { date, format: 'json' } }),
  exportShortageReport: (params) => api.get('/export/shortage-report', { params: { ...params, format: 'json' } }),
  exportRefundReport: (params) => api.get('/export/refund-report', { params: { ...params, format: 'json' } }),
  exportDailyReport: (date) => api.get('/export/daily-report', { params: { date, format: 'json' } }),
  exportOverdueReport: (params) => api.get('/export/overdue-reminders', { params }),
  exportExpiryReport: (params) => api.get('/inventory/expiring', { params })
}

export default api
