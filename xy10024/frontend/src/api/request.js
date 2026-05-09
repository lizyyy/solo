import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000
})

let idempotencyCounter = 0

request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }

    if (config.method === 'post' || config.method === 'put') {
      idempotencyCounter++
      config.headers['X-Idempotency-Key'] = `${Date.now()}-${idempotencyCounter}`
    }

    config.headers['X-Request-ID'] = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const userStore = useUserStore()

    if (error.response?.status === 401) {
      userStore.logout()
      ElMessage.error('登录已过期，请重新登录')
      router.push('/login')
    } else if (error.response?.status === 409) {
      ElMessage.warning('资源已被其他用户修改，请刷新后重试')
    } else if (error.response?.status === 400) {
      ElMessage.error(error.response.data?.error || '请求参数错误')
    } else if (error.response?.status >= 500) {
      ElMessage.error('服务器错误，请稍后重试')
    }

    return Promise.reject(error)
  }
)

export default request
