import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const simulationApi = {
  list: (params) => api.get('/simulations', { params }),
  get: (id) => api.get(`/simulations/${id}`),
  create: (data) => api.post('/simulations', data),
  confirmSkip: (id, data) => api.post(`/simulations/${id}/confirm-skip`, data),
  publish: (id) => api.post(`/simulations/${id}/publish`),
  export: (id) => window.open(`/api/simulations/${id}/export`, '_blank')
}

export const applicationApi = {
  list: () => api.get('/applications'),
  create: (data) => api.post('/applications', data)
}

export const ruleVersionApi = {
  list: () => api.get('/rule-versions'),
  create: (data) => api.post('/rule-versions', data)
}

export const hitConditionApi = {
  list: (ruleVersionId) => api.get(`/rule-versions/${ruleVersionId}/hit-conditions`),
  create: (data) => api.post('/hit-conditions', data)
}

export const approverApi = {
  list: () => api.get('/approvers'),
  create: (data) => api.post('/approvers', data)
}

export const skipReasonApi = {
  list: () => api.get('/skip-reasons'),
  create: (data) => api.post('/skip-reasons', data)
}

export default api
