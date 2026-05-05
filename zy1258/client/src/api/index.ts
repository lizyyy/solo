import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default api

export const healthApi = {
  check: () => api.get('/health')
}

export const importApi = {
  importManifest: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/manifest', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  importEdgeLogs: (file: File, releaseBatchId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (releaseBatchId) {
      formData.append('releaseBatchId', releaseBatchId)
    }
    return api.post('/import/edge-logs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  importPurgeEvents: (file: File, releaseBatchId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (releaseBatchId) {
      formData.append('releaseBatchId', releaseBatchId)
    }
    return api.post('/import/purge-events', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

export const queryApi = {
  getStatistics: () => api.get('/query/statistics'),
  getReleaseBatches: () => api.get('/query/release-batches'),
  getReleaseBatch: (id: string) => api.get(`/query/release-batches/${id}`),
  getDebugTasks: () => api.get('/query/debug-tasks'),
  getDebugTask: (id: string) => api.get(`/query/debug-tasks/${id}`),
  detectRisks: (batchId: string) => api.post(`/query/detect-risks/${batchId}`),
  exportMarkdown: (taskId: string) => `/api/query/report/${taskId}/markdown`,
  exportJson: (taskId: string) => `/api/query/report/${taskId}/json`
}

export const simulationApi = {
  simulateCanary: (data: {
    oldBatchId: string
    newBatchId: string
    parameters: {
      canaryPercentage: number
      affectedEdgeNodes: string[]
      durationMinutes: number
    }
  }) => api.post('/simulate/canary', data),

  simulateRollback: (data: {
    newBatchId: string
    oldBatchId: string
    parameters: {
      rollbackTime: string
      missingResources: string[]
      browserCacheDuration: number
    }
  }) => api.post('/simulate/rollback', data),

  simulateSWResidue: (data: {
    oldBatchId: string
    newBatchId: string
    parameters: {
      swVersion: string
      cachedUrls: string[]
      updateFrequency: number
    }
  }) => api.post('/simulate/sw-residue', data),

  simulatePurgeMiss: (data: {
    batchId: string
    parameters: {
      purgeUrls: string[]
      skippedEdgeNodes: string[]
      missedUrls: string[]
    }
  }) => api.post('/simulate/purge-miss', data)
}
