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

export default {
  patients: {
    list: (params) => api.get('/patients', { params }),
    get: (patientId) => api.get(`/patients/${patientId}`),
    create: (data) => api.post('/patients', data),
    update: (patientId, data) => api.put(`/patients/${patientId}`, data),
    logs: (patientId) => api.get(`/patients/${patientId}/logs`)
  },
  
  wards: {
    list: () => api.get('/wards')
  },
  
  caregivers: {
    list: (params) => api.get('/certificates/caregivers', { params }),
    create: (data) => api.post('/certificates/caregivers', data)
  },
  
  certificates: {
    list: (params) => api.get('/certificates', { params }),
    get: (certId) => api.get(`/certificates/${certId}`),
    create: (data) => api.post('/certificates', data),
    renew: (certId, data) => api.post(`/certificates/${certId}/renew`, null, { params: data }),
    cancel: (certId, data) => api.post(`/certificates/${certId}/cancel`, null, { params: data }),
    logs: (certId) => api.get(`/certificates/${certId}/logs`)
  },
  
  replacements: {
    list: (params) => api.get('/replacements', { params }),
    get: (requestId) => api.get(`/replacements/${requestId}`),
    create: (data) => api.post('/replacements', data),
    review: (requestId, data) => api.post(`/replacements/${requestId}/review`, data)
  },
  
  audit: {
    logs: (params) => api.get('/audit/logs', { params }),
    export: (params) => api.get('/audit/export', { params, responseType: 'blob' }),
    statistics: () => api.get('/audit/statistics')
  }
}
