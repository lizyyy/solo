import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const screeningsAPI = {
  list: () => api.get('/screenings'),
  get: (id) => api.get(`/screenings/${id}`),
  create: (data) => api.post('/screenings', data),
  update: (id, data) => api.put(`/screenings/${id}`, data),
  start: (id) => api.post(`/screenings/${id}/start`),
  end: (id) => api.post(`/screenings/${id}/end`)
}

export const cleaningAPI = {
  list: () => api.get('/cleaning'),
  get: (id) => api.get(`/cleaning/${id}`),
  assign: (id, staffId) => api.post(`/cleaning/${id}/assign`, { staff_id: staffId }),
  start: (id) => api.post(`/cleaning/${id}/start`),
  complete: (id, data) => api.post(`/cleaning/${id}/complete`, data),
  review: (id, approved, notes) => api.post(`/cleaning/${id}/review`, { approved, reviewer_notes: notes })
}

export const inspectionsAPI = {
  list: () => api.get('/inspections'),
  get: (id) => api.get(`/inspections/${id}`),
  start: (id, inspectorId) => api.post(`/inspections/${id}/start`, { inspector_id: inspectorId }),
  updateItem: (id, itemIndex, status, issue) => api.post(`/inspections/${id}/update-item`, { item_index: itemIndex, status, issue }),
  complete: (id, issues, resolution) => api.post(`/inspections/${id}/complete`, { issues, resolution }),
  resolve: (id, resolvedBy, resolution) => api.post(`/inspections/${id}/resolve`, { resolved_by: resolvedBy, resolution })
}

export const shiftsAPI = {
  list: () => api.get('/shifts'),
  create: (data) => api.post('/shifts', data),
  approve: (id, approvedBy) => api.post(`/shifts/${id}/approve`, { approved_by: approvedBy }),
  reject: (id, approvedBy, reason) => api.post(`/shifts/${id}/reject`, { approved_by: approvedBy, reason }),
  callback: (id) => api.post(`/shifts/${id}/callback`)
}

export const positionsAPI = {
  list: () => api.get('/positions'),
  create: (data) => api.post('/positions', data),
  uncovered: () => api.get('/positions/uncovered'),
  resolveUncovered: (id, resolvedBy, notes) => api.post(`/positions/uncovered/${id}/resolve`, { resolved_by: resolvedBy, notes })
}

export const staffAPI = {
  list: () => api.get('/staff'),
  get: (id) => api.get(`/staff/${id}`),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put(`/staff/${id}`, data)
}

export const reportsAPI = {
  summary: (params) => api.get('/reports/summary', { params }),
  export: (params) => api.get('/reports/export', { params, responseType: 'blob' })
}

export default api
