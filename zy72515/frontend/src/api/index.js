import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  response => {
    if (response.data && response.data.success) {
      return response.data.data
    }
    return Promise.reject(response.data?.error || '请求失败')
  },
  error => {
    return Promise.reject(error.message || '网络错误')
  }
)

export const batchApi = {
  getList: () => api.get('/batches'),
  getDetail: (id) => api.get(`/batches/${id}`),
  import: (data) => api.post('/batches/import', data),
  export: (id) => window.open(`/api/batches/${id}/export`, '_blank')
}

export const sampleApi = {
  updateStatus: (id, data) => api.put(`/samples/${id}/status`, data),
  addComment: (id, data) => api.post(`/samples/${id}/comment`, data),
  updateManual: (id, data) => api.put(`/samples/${id}/manual`, data),
  reviewConfirm: (id, data) => api.post(`/samples/${id}/review/confirm`, data),
  reviewReject: (id, data) => api.post(`/samples/${id}/review/reject`, data),
  rollback: (id, data) => api.post(`/samples/${id}/rollback`, data),
  getLogs: (id) => api.get(`/samples/${id}/logs`),
  getReviewList: (batchId) => api.get('/samples/review/list', { params: { batchId } })
}

export const dashboardApi = {
  getReviewData: () => api.get('/dashboard/review'),
  getBoundaryRules: () => api.get('/dashboard/boundary-rules'),
  getSampleStatuses: () => api.get('/dashboard/sample-statuses')
}

export default api
