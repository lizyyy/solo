import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const migrationApi = {
  list: (skip = 0, limit = 100) => api.get(`/migration?skip=${skip}&limit=${limit}`),
  get: (id) => api.get(`/migration/${id}`),
  create: (data) => api.post('/migration', data),
  update: (id, data) => api.put(`/migration/${id}`, data),
  delete: (id) => api.delete(`/migration/${id}`),
  recalculateTables: (id) => api.post(`/migration/${id}/recalculate-tables`),
  addAffectedTable: (id, data) => api.post(`/migration/${id}/affected-tables`, data),
  addRollbackScript: (id, data) => api.post(`/migration/${id}/rollback-scripts`, data)
}

export const approvalApi = {
  getChain: (migrationId) => api.get(`/approval/chain/${migrationId}`),
  createChain: (migrationId, data) => api.post(`/approval/chain/${migrationId}`, data),
  startChain: (chainId) => api.post(`/approval/chain/${chainId}/start`),
  approveStep: (stepId, approver, comment) => api.post(`/approval/step/${stepId}/approve`, null, { params: { approver, comment } }),
  rejectStep: (stepId, approver, comment) => api.post(`/approval/step/${stepId}/reject`, null, { params: { approver, comment } })
}

export const executionApi = {
  listLogs: (migrationId = null, skip = 0, limit = 100) => {
    let url = `/execution/logs?skip=${skip}&limit=${limit}`
    if (migrationId) url += `&migration_id=${migrationId}`
    return api.get(url)
  },
  getLog: (id) => api.get(`/execution/logs/${id}`),
  start: (migrationId, executedBy) => api.post(`/execution/${migrationId}/start`, null, { params: { executed_by: executedBy } }),
  complete: (logId, success, output, errorMessage, affectedRows) => api.post(`/execution/logs/${logId}/complete`, null, {
    params: { success, output, error_message: errorMessage, affected_rows: affectedRows }
  }),
  replay: (logId, executedBy) => api.post(`/execution/logs/${logId}/replay`, null, { params: { executed_by: executedBy } }),
  manualFix: (migrationId, scriptContent, executedBy) => api.post(`/execution/${migrationId}/manual-fix`, null, {
    params: { script_content: scriptContent, executed_by: executedBy }
  })
}

export const exportApi = {
  exportExcel: (migrationId) => {
    window.open(`/api/export/migration/${migrationId}/excel`, '_blank')
  },
  getTrace: (migrationId) => api.get(`/export/migration/${migrationId}/trace`)
}

export default api