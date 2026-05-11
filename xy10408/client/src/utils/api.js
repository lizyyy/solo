import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const groupApi = {
  getAll: () => api.get('/groups'),
  create: (data) => api.post('/groups', data),
  complete: (id) => api.put(`/groups/${id}/complete`)
}

export const productApi = {
  getAll: () => api.get('/products'),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data)
}

export const orderApi = {
  getAll: (params) => api.get('/orders', { params }),
  import: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/orders/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  markOutOfStock: (id, reason) => api.put(`/orders/${id}/mark-out-of-stock`, { reason }),
  getPlans: (id) => api.get(`/orders/${id}/plans`),
  createPlan: (id, data) => api.post(`/orders/${id}/plans`, data)
}

export const planApi = {
  confirm: (id) => api.post(`/plans/${id}/confirm`)
}

export const compensationApi = {
  getSummary: (groupId) => api.get('/compensation-summary', { params: { group_id: groupId } }),
  exportLeaderSummary: (groupId) => `/api/export/leader-summary/${groupId}`,
  exportExcel: (groupId) => `/api/export/excel/${groupId}`
}

export default api
