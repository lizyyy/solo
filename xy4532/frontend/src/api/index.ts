import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { APIResponse } from '@/types'

const service: AxiosInstance = axios.create({
  baseURL: '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

service.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error) => {
    return Promise.reject(error)
  }
)

export async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
  const response = await service.request<APIResponse<T>>(config)
  const data = response.data
  
  if (data.success) {
    return data.data as T
  } else {
    throw new Error(data.message || '请求失败')
  }
}

export async function requestRaw<T = any>(config: AxiosRequestConfig): Promise<APIResponse<T>> {
  const response = await service.request<APIResponse<T>>(config)
  return response.data
}

export default service
