import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const departmentApi = {
  getAll: () => api.get('/departments'),
  getById: (id) => api.get(`/departments/${id}`),
  getUsage: (date) => api.get('/departments/usage', { params: { date } }),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data)
}

export const itemApi = {
  getAll: () => api.get('/items'),
  getById: (id) => api.get(`/items/${id}`),
  getAddable: () => api.get('/items/addable'),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data)
}

export const packageApi = {
  getAll: () => api.get('/packages'),
  getById: (id) => api.get(`/packages/${id}`),
  getByType: (type) => api.get(`/packages/type/${type}`),
  create: (data) => api.post('/packages', data),
  update: (id, data) => api.put(`/packages/${id}`, data)
}

export const customerApi = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data)
}

export const appointmentApi = {
  getAll: (params) => api.get('/appointments', { params }),
  getById: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  updateStatus: (id, status) => api.put(`/appointments/${id}/status`, { status })
}

export const addRemoveApi = {
  addItem: (data) => api.post('/add-remove/add', data),
  removeItem: (data) => api.post('/add-remove/remove', data)
}

export const paymentApi = {
  pay: (data) => api.post('/payments/pay', data),
  refund: (data) => api.post('/payments/refund', data),
  getTransactions: (params) => api.get('/payments/transactions', { params }),
  updateReportStatus: (data) => api.post('/payments/report-status', data)
}

export const staffApi = {
  getAll: () => api.get('/staff')
}

export default api
