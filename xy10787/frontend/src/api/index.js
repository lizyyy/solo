import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

const generateIdempotencyKey = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

api.interceptors.request.use(config => {
  if (config.method !== 'get' && !config.headers['X-Idempotency-Key']) {
    config.headers['X-Idempotency-Key'] = generateIdempotencyKey()
  }
  config.headers['X-Operator'] = 'sre-user'
  return config
})

api.interceptors.response.use(
  response => response.data,
  error => Promise.reject(error)
)

export const translationApi = {
  getLanguageKeys: (params = {}) => api.get('/translation/language-keys', { params }),
  createLanguageKey: (data) => api.post('/translation/language-keys', data),
  updateLanguageKey: (id, data) => api.put(`/translation/language-keys/${id}`, data),
  
  getLanguagePacks: () => api.get('/translation/language-packs'),
  createLanguagePack: (data) => api.post('/translation/language-packs', data),
  
  getTranslations: (params = {}) => api.get('/translation', { params }),
  getTranslation: (id) => api.get(`/translation/${id}`),
  updateTranslation: (id, data) => api.put(`/translation/${id}`, data),
  
  startReview: (id) => api.post(`/translation/${id}/start-review`),
  reviewTranslation: (id, data) => api.post(`/translation/${id}/review`, data),
  
  compareTranslation: (data) => api.post('/translation/compare', data),
  validatePlaceholder: (params) => api.post('/translation/validate-placeholder', null, { params }),
  recalculateTranslations: (languagePackId) => api.post('/translation/recalculate', null, { params: { language_pack_id: languagePackId } })
}

export const versionApi = {
  getVersions: (params = {}) => api.get('/version', { params }),
  getVersion: (id) => api.get(`/version/${id}`),
  createVersion: (data) => api.post('/version', data),
  publishVersion: (id) => api.post(`/version/${id}/publish`),
  regenerateReport: (id) => api.post(`/version/${id}/regenerate-report`)
}

export const reportApi = {
  getReports: (params = {}) => api.get('/report', { params }),
  getReport: (id) => api.get(`/report/${id}`),
  exportLanguagePack: (data) => api.post('/report/export', data, { responseType: 'blob' })
}

export default api
