import axios from 'axios'

function encodeOp(name) {
  return encodeURIComponent(name || '')
}

const storedOp = localStorage.getItem('operator') || '老叶'
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'x-operator': encodeOp(storedOp)
  }
})

api.interceptors.request.use(
  (config) => {
    const op = localStorage.getItem('operator') || '老叶'
    config.headers['x-operator'] = encodeOp(op)
    return config
  }
)

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.message || err.message || '请求失败'
    console.error('[API Error]', msg, err.config?.url)
    return Promise.reject({ code: err.response?.status || 500, message: msg, raw: err })
  }
)

export default api

export const setOperator = (name) => {
  localStorage.setItem('operator', name)
  api.defaults.headers['x-operator'] = encodeOp(name)
}

export const endpoints = {
  health: '/health',
  bootstrap: '/bootstrap',
  materials: '/materials',
  materialStatus: '/materials/status-enum',
  materialDetail: id => `/materials/${id}`,
  materialReview: id => `/materials/${id}/review`,
  minutes: '/meeting-minutes',
  minutesMappings: '/meeting-minutes/field-mappings',
  minutesDetail: id => `/meeting-minutes/${id}`,
  collisions: '/collisions',
  collisionDetail: id => `/collisions/${id}`,
  collisionLinkMinutes: id => `/collisions/${id}/link-minutes`,
  summary: '/summary',
  summaryDecisions: '/summary/decisions',
  summaryAnomaly: '/summary/anomaly-details'
}
