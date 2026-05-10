import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const stores = {
  getAll: () => api.get('/stores')
}

export const skills = {
  getAll: () => api.get('/skills')
}

export const employees = {
  getAll: (storeId) => api.get('/employees', { params: { storeId } })
}

export const schedules = {
  getByDate: (startDate, endDate, storeId) => 
    api.get('/schedules', { params: { startDate, endDate, storeId } })
}

export const transferRequests = {
  getAll: (params) => api.get('/transfer-requests', { params }),
  validate: (data) => api.post('/transfer-requests/validate', data),
  create: (data) => api.post('/transfer-requests', data),
  approve: (id, data) => api.put(`/transfer-requests/${id}/approve`, data),
  reject: (id, data) => api.put(`/transfer-requests/${id}/reject`, data)
}

export const allowance = {
  calculate: (data) => api.post('/allowance/calculate', data)
}

export const exportExcel = {
  download: (params) => {
    const queryString = new URLSearchParams(params).toString()
    window.open(`/api/export?${queryString}`, '_blank')
  }
}

export default api
