import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const nodeGroupApi = {
  list: () => api.get('/node-groups'),
  create: (data) => api.post('/node-groups', data)
}

export const configVersionApi = {
  list: (groupId) => api.get(`/node-groups/${groupId}/config-versions`),
  create: (data) => api.post('/config-versions', data)
}

export const syncApi = {
  list: (groupId) => api.get('/sync-statuses', { params: { group_id: groupId } }),
  get: (id) => api.get(`/sync-statuses/${id}`),
  create: (data) => api.post('/sync/create', data),
  intercept: (id, data) => api.post(`/sync/${id}/intercept`, data),
  correct: (id, data) => api.post(`/sync/${id}/correct`, data),
  rollback: (id, data) => api.post(`/sync/${id}/rollback`, data),
  export: (id) => window.open(`/api/export/sync/${id}`, '_blank')
}

export const conflictApi = {
  resolve: (id, data) => api.post(`/conflicts/${id}/resolve`, data)
}

export const initTestData = () => api.post('/init-test-data')

export default api
