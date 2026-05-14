import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const componentAPI = {
  list: (params = {}) => api.get('/components', { params }),
  get: (id) => api.get(`/components/${id}`),
  create: (data) => api.post('/components', data),
  update: (id, data) => api.put(`/components/${id}`, data),
  delete: (id) => api.delete(`/components/${id}`),
  
  getSchemas: (id) => api.get(`/components/${id}/schemas`),
  createSchema: (id, data) => api.post(`/components/${id}/schemas`, data),
  
  getPropertyPanels: (id) => api.get(`/components/${id}/property-panels`),
  createPropertyPanel: (id, data) => api.post(`/components/${id}/property-panels`, data),
  updatePropertyPanel: (id, data) => api.put(`/property-panels/${id}`, data),
  
  getVersions: (id) => api.get(`/components/${id}/versions`),
  createVersion: (id, data) => api.post(`/components/${id}/versions`, data),
  
  getDependencyChecks: (id) => api.get(`/components/${id}/dependency-checks`),
  createDependencyCheck: (id, data) => api.post(`/components/${id}/dependency-checks`, data),
  
  getExamplePreviews: (id) => api.get(`/components/${id}/example-previews`),
  createExamplePreview: (id, data) => api.post(`/components/${id}/example-previews`, data),
  
  getCompatibilityReports: (id) => api.get(`/components/${id}/compatibility-reports`),
  createCompatibilityReport: (id, data) => api.post(`/components/${id}/compatibility-reports`, data),
  manualUpdateReport: (id, data) => api.put(`/compatibility-reports/${id}/manual`, data),
  
  getProcessingChains: (id) => api.get(`/components/${id}/processing-chains`),
  createProcessingChain: (id, data) => api.post(`/components/${id}/processing-chains`, data),
  replayChain: (chainId, actionHash = null) => api.post(`/processing-chains/${chainId}/replay`, null, { params: { action_hash: actionHash } }),
  getChainTrace: (chainId) => api.get(`/processing-chains/${chainId}/trace`),
  
  export: (data) => api.post('/export', data, { responseType: 'blob' })
}

export default api
