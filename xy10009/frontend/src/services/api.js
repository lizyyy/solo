import axios from 'axios'
import router from '@/router'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          router.push('/login')
          ElMessage.error('登录已过期，请重新登录')
          break
        case 403:
          ElMessage.error('没有权限执行此操作')
          break
        case 409:
          ElMessage.error(error.response.data.message || '数据已被修改，请刷新后重试')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器错误，请稍后重试')
          break
        default:
          ElMessage.error(error.response.data.message || '请求失败')
      }
    } else if (error.request) {
      ElMessage.error('网络连接失败，请检查网络')
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getCurrentUser: () => api.get('/auth/me')
}

export const warehouseApi = {
  list: () => api.get('/warehouses'),
  get: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`)
}

export const productApi = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
}

export const countTaskApi = {
  list: (params) => api.get('/count-tasks', { params }),
  get: (id) => api.get(`/count-tasks/${id}`),
  create: (data) => api.post('/count-tasks', data),
  start: (id) => api.put(`/count-tasks/${id}/start`),
  complete: (id, data) => api.put(`/count-tasks/${id}/complete`, data),
  cancel: (id) => api.put(`/count-tasks/${id}/cancel`),
  updateDetail: (id, data) => api.put(`/count-tasks/details/${id}`, data),
  syncDetails: (details) => api.post('/count-tasks/sync-details', { details })
}

export const historyApi = {
  list: (params) => api.get('/history', { params }),
  get: (id) => api.get(`/history/${id}`),
  getByEntity: (entityId, params) => api.get(`/history/entity/${entityId}`, { params })
}

export const reportApi = {
  exportCountTask: (id) => {
    const token = localStorage.getItem('token')
    return `/api/reports/count-task/${id}/excel?token=${token}`
  },
  exportInventory: (warehouseId) => {
    const token = localStorage.getItem('token')
    let url = '/api/reports/inventory/excel'
    if (warehouseId) {
      url += `?warehouseId=${warehouseId}`
    }
    url += `&token=${token}`
    return url
  },
  getStatistics: (id) => api.get(`/reports/count-task/${id}/statistics`)
}

export default api
