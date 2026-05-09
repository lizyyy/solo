import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const PENDING_REQUESTS_KEY = 'pending_requests'

interface PendingRequest {
  idempotencyKey: string
  url: string
  method: string
  data: any
  timestamp: number
  retryCount: number
}

function generateIdempotencyKey(): string {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
}

function savePendingRequest(req: PendingRequest): void {
  try {
    const pending = getPendingRequests()
    pending.push(req)
    localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(pending))
  } catch (e) {
    console.warn('Failed to save pending request:', e)
  }
}

function removePendingRequest(idempotencyKey: string): void {
  try {
    const pending = getPendingRequests().filter(r => r.idempotencyKey !== idempotencyKey)
    localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(pending))
  } catch (e) {
    console.warn('Failed to remove pending request:', e)
  }
}

function getPendingRequests(): PendingRequest[] {
  try {
    const data = localStorage.getItem(PENDING_REQUESTS_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    return []
  }
}

function clearPendingRequests(): void {
  localStorage.removeItem(PENDING_REQUESTS_KEY)
}

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore()
    
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    
    if (config.method?.toUpperCase() === 'POST' || config.method?.toUpperCase() === 'PUT') {
      if (!config.headers['X-Idempotency-Key']) {
        config.headers['X-Idempotency-Key'] = generateIdempotencyKey()
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    if (!navigator.onLine && originalRequest) {
      const pendingReq: PendingRequest = {
        idempotencyKey: originalRequest.headers['X-Idempotency-Key'] || generateIdempotencyKey(),
        url: originalRequest.url || '',
        method: originalRequest.method || 'GET',
        data: originalRequest.data,
        timestamp: Date.now(),
        retryCount: 0,
      }
      savePendingRequest(pendingReq)
      
      ElMessage.warning('网络断开，请求已保存，恢复网络后将自动重试')
      
      return Promise.reject(error)
    }
    
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      ElMessage.error('登录已过期，请重新登录')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    if (error.response?.status === 409) {
      ElMessage.warning(error.response.data?.message || '请求正在处理中，请稍后再试')
      return Promise.reject(error)
    }
    
    const errorMessage = error.response?.data?.message || error.message || '请求失败'
    if (!originalRequest?._silent) {
      ElMessage.error(errorMessage)
    }
    
    return Promise.reject(error)
  }
)

async function retryPendingRequests(): Promise<void> {
  const pending = getPendingRequests()
  
  if (pending.length === 0) return
  
  ElMessage.info(`正在重试 ${pending.length} 个待处理请求...`)
  
  for (const req of pending) {
    try {
      await api.request({
        url: req.url,
        method: req.method,
        data: req.data,
        headers: {
          'X-Idempotency-Key': req.idempotencyKey,
        },
      })
      
      removePendingRequest(req.idempotencyKey)
    } catch (e) {
      console.warn(`Retry failed for ${req.url}:`, e)
    }
  }
  
  const remaining = getPendingRequests()
  if (remaining.length === 0) {
    ElMessage.success('所有待处理请求已完成')
  }
}

function setupNetworkListener(): void {
  window.addEventListener('online', () => {
    console.log('Network back online, retrying pending requests...')
    retryPendingRequests()
  })
  
  window.addEventListener('offline', () => {
    console.log('Network offline')
  })
}

export {
  api,
  generateIdempotencyKey,
  getPendingRequests,
  clearPendingRequests,
  retryPendingRequests,
  setupNetworkListener,
}
