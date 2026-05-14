import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const taskApi = {
  create: (data) => api.post('/tasks', data),
  list: () => api.get('/tasks')
}

export const calendarApi = {
  get: (year, month) => api.get(`/calendar/${year}/${month}`)
}

export const executionApi = {
  updateStatus: (id, status, result, errorMessage) => 
    api.post(`/executions/${id}/status`, null, { params: { status, result, error_message: errorMessage } }),
  compensate: (id) => api.post(`/executions/${id}/compensate`),
  review: (id) => api.post(`/executions/${id}/review`)
}

export const statsApi = {
  dashboard: () => api.get('/stats/dashboard')
}

export const exportApi = {
  calendar: (year, month) => 
    axios.get(`/api/export/${year}/${month}`, { responseType: 'blob' })
}

export default api
