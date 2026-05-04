import axios from 'axios'
import { ElMessage } from 'element-plus'

const API_BASE_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export const importApi = {
  importOriginalTexts: (data) => api.post('/import/original-texts', data),
  importBrailleProofreadings: (data) => api.post('/import/braille-proofreadings', data),
  importTemperatureCurves: (data) => api.post('/import/temperature-curves', data),
  importStudentFeedbacks: (data) => api.post('/import/student-feedbacks', data)
}

export const riskApi = {
  runDetection: () => api.post('/risks/detect'),
  getRiskList: (params) => api.get('/risks', { params }),
  getRiskStats: () => api.get('/risks/stats'),
  reviewRisk: (id, data) => api.put(`/risks/${id}/review`, data)
}

export const exportApi = {
  getReleaseMarkdown: (teacherName) => api.post('/export/release-markdown', { teacherName }),
  downloadReleaseMarkdown: (teacherName) => {
    const url = `${API_BASE_URL}/export/release-markdown/download?teacherName=${encodeURIComponent(teacherName || '')}`
    window.open(url, '_blank')
  },
  getAuditPackage: (teacherName) => api.post('/export/audit-package', { teacherName }),
  downloadAuditPackage: (teacherName) => {
    const url = `${API_BASE_URL}/export/audit-package/download?teacherName=${encodeURIComponent(teacherName || '')}`
    window.open(url, '_blank')
  }
}

export const healthApi = {
  checkHealth: () => api.get('/health')
}

export default api
