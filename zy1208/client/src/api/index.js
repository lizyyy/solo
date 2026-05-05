import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.message || error.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export const drillApi = {
  create: (data, files = []) => {
    const formData = new FormData()
    if (data.name) formData.append('name', data.name)
    if (data.description) formData.append('description', data.description)
    files.forEach(file => {
      formData.append('files', file)
    })
    return api.post('/drills', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  
  list: () => api.get('/drills'),
  
  get: (id) => api.get(`/drills/${id}`),
  
  update: (id, data, files = []) => {
    const formData = new FormData()
    if (data.name) formData.append('name', data.name)
    if (data.description) formData.append('description', data.description)
    files.forEach(file => {
      formData.append('files', file)
    })
    return api.put(`/drills/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  
  delete: (id) => api.delete(`/drills/${id}`)
}

export const analysisApi = {
  run: (id) => api.post(`/drills/${id}/analyze`),
  get: (id) => api.get(`/drills/${id}/analysis`)
}

export const reportApi = {
  getMarkdown: (id) => api.get(`/drills/${id}/report/markdown`, {
    responseType: 'blob'
  }),
  getJson: (id) => api.get(`/drills/${id}/report/json`, {
    responseType: 'blob'
  })
}

export default api
