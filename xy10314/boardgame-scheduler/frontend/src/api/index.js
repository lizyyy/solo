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

export const tablesApi = {
  getAll: () => api.get('/tables'),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  delete: (id) => api.delete(`/tables/${id}`)
}

export const scriptsApi = {
  getAll: () => api.get('/scripts'),
  create: (data) => api.post('/scripts', data),
  update: (id, data) => api.put(`/scripts/${id}`, data),
  delete: (id) => api.delete(`/scripts/${id}`)
}

export const hostsApi = {
  getAll: () => api.get('/hosts'),
  create: (data) => api.post('/hosts', data),
  update: (id, data) => api.put(`/hosts/${id}`, data),
  delete: (id) => api.delete(`/hosts/${id}`),
  addLeave: (data) => api.post('/hosts/leaves', data)
}

export const reservationsApi = {
  getByDate: (date) => api.get('/reservations', { params: { date } }),
  getById: (id) => api.get(`/reservations/${id}`),
  getHistory: (id) => api.get(`/reservations/${id}/history`),
  validate: (data) => api.post('/reservations/validate', data),
  create: (data) => api.post('/reservations', data),
  update: (id, data) => api.put(`/reservations/${id}`, data),
  cancel: (id) => api.post(`/reservations/${id}/cancel`),
  getRevenueStats: (startDate, endDate) => api.get('/reservations/stats/revenue', {
    params: { start_date: startDate, end_date: endDate }
  }),
  exportDaily: (date) => api.get('/reservations/export/daily', {
    params: { date },
    responseType: 'blob'
  })
}

export const waitlistApi = {
  getAll: (date) => api.get('/waitlist', { params: { date } }),
  getById: (id) => api.get(`/waitlist/${id}`),
  create: (data) => api.post('/waitlist', data),
  convert: (id, data) => api.post(`/waitlist/${id}/convert`, data),
  delete: (id) => api.delete(`/waitlist/${id}`)
}

export default api
