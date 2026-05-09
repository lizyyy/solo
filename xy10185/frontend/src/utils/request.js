import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

let isRefreshing = false
let retryQueue = []

request.interceptors.request.use(
  config => {
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  response => {
    const res = response.data
    if (response.config.responseType === 'blob') {
      return response
    }
    
    if (res.success) {
      return res.data
    } else {
      ElMessage({
        message: res.message || '请求失败',
        type: 'error',
        duration: 5000
      })
      return Promise.reject(new Error(res.message || '请求失败'))
    }
  },
  error => {
    const message = error.response?.data?.message || error.message || '网络错误'
    const status = error.response?.status
    
    if (status === 401) {
      ElMessageBox.confirm('登录已过期，请重新登录', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        location.reload()
      })
    } else if (status === 403) {
      ElMessage({
        message: '没有权限执行此操作',
        type: 'warning',
        duration: 5000
      })
    } else if (status === 404) {
      ElMessage({
        message: '请求的资源不存在',
        type: 'warning',
        duration: 5000
      })
    } else if (status === 500) {
      ElMessage({
        message: '服务器内部错误，请稍后重试',
        type: 'error',
        duration: 5000
      })
    } else {
      ElMessage({
        message: message,
        type: 'error',
        duration: 5000
      })
    }
    
    return Promise.reject(error)
  }
)

export default request