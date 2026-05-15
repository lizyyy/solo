import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const statisticsApi = {
  getStatistics: () => api.get('/statistics')
}

export const mattersApi = {
  getMatters: (params) => api.get('/matters', { params }),
  createMatter: (data) => api.post('/matters', data),
  updateMatter: (id, data) => api.put(`/matters/${id}`, data)
}

export const identityApi = {
  getTypes: (params) => api.get('/identity-types', { params }),
  createType: (data) => api.post('/identity-types', data),
  updateType: (id, data) => api.put(`/identity-types/${id}`, data)
}

export const attachmentsApi = {
  getAttachments: (params) => api.get('/attachments', { params }),
  createAttachment: (data) => api.post('/attachments', data),
  updateAttachment: (id, data) => api.put(`/attachments/${id}`, data)
}

export const gapsApi = {
  getGaps: (params) => api.get('/gaps', { params }),
  createGap: (data) => api.post('/gaps', data),
  resolveGap: (id, data) => api.put(`/gaps/${id}/resolve`, data)
}

export const exceptionsApi = {
  getExceptions: (params) => api.get('/exceptions', { params }),
  createException: (data) => api.post('/exceptions', data),
  fixException: (id, data) => api.put(`/exceptions/${id}/fix`, data)
}

export const correctionOpinionsApi = {
  getOpinions: (params) => api.get('/correction-opinions', { params }),
  createOpinion: (data) => api.post('/correction-opinions', data),
  updateOpinion: (id, data) => api.put(`/correction-opinions/${id}`, data),
  deleteOpinion: (id) => api.delete(`/correction-opinions/${id}`)
}

export const windowAcceptancesApi = {
  getAcceptances: (params) => api.get('/window-acceptances', { params }),
  createAcceptance: (data) => api.post('/window-acceptances', data),
  updateAcceptance: (id, data) => api.put(`/window-acceptances/${id}`, data),
  deleteAcceptance: (id) => api.delete(`/window-acceptances/${id}`)
}

export const preReviewApi = {
  calculate: (data) => api.post('/pre-review/calculate', data),
  getSummary: (params) => api.get('/pre-review/summary', { params })
}

export const reportApi = {
  exportReport: (params) => api.get('/report/export', { params }),
  getSummary: (params) => api.get('/report/summary', { params })
}

export const historyApi = {
  getHistory: (params) => api.get('/history', { params })
}

export default api
