import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { v4 as uuidv4 } from 'uuid'
import type { ApiResponse } from '@shared/types'

declare module 'axios' {
  interface AxiosRequestConfig {
    _skipRetry?: boolean
    _retryCountLimit?: number
    _retryDelay?: number
    _retryCount?: number
  }
}

export interface RequestOptions {
  skipRetry?: boolean
  retryCount?: number
  retryDelay?: number
  generateRequestId?: boolean
}

const DEFAULT_RETRY_COUNT = 3
const DEFAULT_RETRY_DELAY = 1000

const RETRYABLE_ERROR_CODES = [
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ERR_NETWORK'
]

const RETRYABLE_STATUS_CODES = [502, 503, 504]

class ApiClient {
  private client: AxiosInstance
  private pendingRequests: Map<string, Promise<any>> = new Map()

  constructor(baseURL: string = '/api') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      if (!config.headers['X-Request-ID']) {
        config.headers['X-Request-ID'] = uuidv4()
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config as (InternalAxiosRequestConfig & { _retryCount?: number; _retryCountLimit?: number; _retryDelay?: number })
        
        if (!config) {
          return Promise.reject(error)
        }

        const shouldRetry = this.shouldRetry(error, config)
        if (!shouldRetry) {
          return Promise.reject(this.normalizeError(error))
        }

        config._retryCount = (config._retryCount || 0) + 1
        const maxRetries = config._retryCountLimit || DEFAULT_RETRY_COUNT

        if (config._retryCount > maxRetries) {
          return Promise.reject(this.normalizeError(error))
        }

        const delay = config._retryDelay || DEFAULT_RETRY_DELAY
        await this.sleep(delay * config._retryCount)

        return this.client(config)
      }
    )
  }

  private shouldRetry(error: any, config: AxiosRequestConfig): boolean {
    if ((config as any)._skipRetry) {
      return false
    }

    if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
      return true
    }

    if (error.response) {
      return RETRYABLE_STATUS_CODES.includes(error.response.status)
    }

    return false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private normalizeError(error: any): ApiError {
    if (error.response?.data) {
      const data = error.response.data as ApiResponse<any>
      if (data.error) {
        return {
          code: data.error.code,
          message: data.error.message,
          details: data.error.details,
          requestId: data.requestId
        }
      }
    }

    return {
      code: error.code || 'NETWORK_ERROR',
      message: error.message || '网络错误',
      details: error.config ? { url: error.config.url, method: error.config.method } : undefined
    }
  }

  async get<T = any>(
    url: string,
    params?: Record<string, any>,
    options: RequestOptions = {}
  ): Promise<T> {
    const cacheKey = `GET:${url}:${JSON.stringify(params || {})}`
    
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!
    }

    const promise = this.client.get<ApiResponse<T>>(url, {
      params,
      ...(options.skipRetry && { _skipRetry: true })
    }).then(response => {
      this.pendingRequests.delete(cacheKey)
      return this.handleResponse(response)
    }).catch(error => {
      this.pendingRequests.delete(cacheKey)
      throw error
    })

    this.pendingRequests.set(cacheKey, promise)
    return promise
  }

  async post<T = any>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const requestId = options.generateRequestId !== false ? uuidv4() : (data?.requestId || uuidv4())
    
    const response = await this.client.post<ApiResponse<T>>(url, {
      ...data,
      requestId: data?.requestId || requestId
    }, {
      headers: {
        'X-Request-ID': requestId
      },
      ...(options.skipRetry && { _skipRetry: true }),
      _retryCountLimit: options.retryCount,
      _retryDelay: options.retryDelay
    })

    return this.handleResponse(response)
  }

  async put<T = any>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const requestId = options.generateRequestId !== false ? uuidv4() : (data?.requestId || uuidv4())

    const response = await this.client.put<ApiResponse<T>>(url, {
      ...data,
      requestId: data?.requestId || requestId
    }, {
      headers: {
        'X-Request-ID': requestId
      },
      ...(options.skipRetry && { _skipRetry: true })
    })

    return this.handleResponse(response)
  }

  async delete<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const requestId = options.generateRequestId !== false ? uuidv4() : uuidv4()

    const response = await this.client.delete<ApiResponse<T>>(url, {
      headers: {
        'X-Request-ID': requestId
      },
      ...(options.skipRetry && { _skipRetry: true })
    })

    return this.handleResponse(response)
  }

  private handleResponse<T>(response: AxiosResponse<ApiResponse<T>>): T {
    const { data } = response

    if (!data.success) {
      throw {
        code: data.error?.code || 'UNKNOWN_ERROR',
        message: data.error?.message || '未知错误',
        details: data.error?.details,
        requestId: data.requestId
      }
    }

    return data.data as T
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  requestId?: string
}

export const api = new ApiClient()

export default api
