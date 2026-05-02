import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => {
    const { data } = response
    if (data.success) {
      return data
    } else {
      ElMessage.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message || '请求失败'))
    }
  },
  error => {
    const message = error.response?.data?.message || error.message || '网络错误'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export const ticketApi = {
  getKanban: (keyword) => api.get('/tickets/kanban', { params: { keyword } }),
  
  getList: (params) => api.get('/tickets', { params }),
  
  getDetail: (id) => api.get(`/tickets/${id}`),
  
  create: (data) => api.post('/tickets', data),
  
  update: (id, data) => api.put(`/tickets/${id}`, data),
  
  transition: (id, targetStatus, reason) => 
    api.post(`/tickets/${id}/transition`, { targetStatus, reason }),
  
  getStatusInfo: () => api.get('/tickets/status/info')
}

export const csvApi = {
  export: (status) => {
    const url = status 
      ? `/api/csv/export?status=${encodeURIComponent(status)}`
      : '/api/csv/export'
    window.open(url, '_blank')
  },
  
  import: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return axios.post('/api/csv/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(response => {
      const { data } = response
      if (data.success) {
        return data
      } else {
        ElMessage.error(data.message || '导入失败')
        return Promise.reject(new Error(data.message || '导入失败'))
      }
    })
  },
  
  downloadTemplate: () => {
    window.open('/api/csv/template', '_blank')
  }
}

export default api
