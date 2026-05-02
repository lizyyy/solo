import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const caseApi = {
  getAll: (params = {}) => api.get('/cases', { params }),
  getById: (id) => api.get(`/cases/${id}`),
  create: (data) => api.post('/cases', data),
  transition: (id, data) => api.put(`/cases/${id}/transition`, data)
}

export const toothApi = {
  create: (caseId, data) => api.post(`/cases/${caseId}/teeth`, data)
}

export const reworkApi = {
  create: (data) => api.post('/rework-requests', data),
  review: (id, data) => api.put(`/rework-requests/${id}/review`, data)
}

export const tryInFeedbackApi = {
  create: (data) => api.post('/try-in-feedbacks', data),
  followUp: (id, data) => api.put(`/try-in-feedbacks/${id}/follow-up`, data)
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard')
}

export const importExportApi = {
  importData: (entityType, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/import/${entityType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  exportData: (entityType, format) => {
    return api.get(`/export/${entityType}`, { 
      params: { format },
      responseType: 'blob'
    })
  }
}

export const validationApi = {
  validate: (caseId) => api.get(`/validation/${caseId}`)
}

export default api
