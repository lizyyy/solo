import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default {
  getResumes: (params) => api.get('/resumes', { params }),
  getResumeDetail: (id) => api.get(`/resumes/${id}`),
  uploadResume: (formData) => api.post('/resumes/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  parseResume: (id) => api.post(`/resumes/${id}/parse`),
  matchResume: (id, jobId) => api.post(`/resumes/${id}/match`, null, { params: { job_id: jobId } }),
  recalculateMatch: (id) => api.post(`/resumes/${id}/recalculate-match`),
  reviewResume: (id, data) => api.post(`/resumes/${id}/review`, data),
  getParseDiff: (id, version1, version2) => api.get(`/resumes/${id}/diff`, { params: { version1, version2 } }),

  getJobs: (params) => api.get('/jobs', { params }),
  createJob: (data) => api.post('/jobs', data),
  updateJob: (id, data) => api.put(`/jobs/${id}`, data),
  deleteJob: (id) => api.delete(`/jobs/${id}`),

  getStatistics: () => api.get('/statistics'),
  getDailyTrend: (days) => api.get('/statistics/daily-trend', { params: { days } }),
  getTopSkills: (top_n) => api.get('/statistics/top-skills', { params: { top_n } }),

  previewExport: (data) => api.post('/export/preview', data),
  downloadExport: (data) => api.post('/export/download', data, { responseType: 'blob' }),
  markAsExported: (ids) => api.post('/export/mark-exported', ids)
}
