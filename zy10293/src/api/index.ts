import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const materialApi = {
  list: (params?: any) => api.get('/materials', { params }),
  create: (data: any) => api.post('/materials', data),
  update: (id: number, data: any) => api.put(`/materials/${id}`, data)
}

export const schemeApi = {
  list: (params?: any) => api.get('/schemes', { params }),
  get: (id: number) => api.get(`/schemes/${id}`),
  create: (data: any) => api.post('/schemes', data),
  approve: (id: number) => api.post(`/schemes/${id}/approve`)
}

export const tastingApi = {
  list: (params?: any) => api.get('/tastings', { params }),
  create: (data: any) => api.post('/tastings', data)
}

export const feedbackApi = {
  create: (data: any) => api.post('/feedbacks', data)
}

export const productApi = {
  list: () => api.get('/products'),
  create: (data: any) => api.post('/products', data)
}

export const saleApi = {
  list: (params?: any) => api.get('/sales', { params }),
  create: (data: any) => api.post('/sales', data)
}

export const customerApi = {
  list: (params?: any) => api.get('/customers', { params }),
  create: (data: any) => api.post('/customers', data)
}

export const statsApi = {
  conversion: (params?: any) => api.get('/stats/conversion', { params }),
  schemePerformance: () => api.get('/stats/scheme-performance')
}

export default api
