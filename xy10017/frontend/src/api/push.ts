import { api } from './http'
import type { PushMessage, PushStatus, PushType, Statistics } from '@/types'

export interface CreatePushParams {
  title: string
  content: string
  pushType?: PushType
  targetUsers?: string[]
  priority?: number
  scheduledAt?: string
}

export interface UpdatePushParams {
  title?: string
  content?: string
  pushType?: PushType
  targetUsers?: string[]
  priority?: number
  scheduledAt?: string
}

export interface ListPushParams {
  page?: number
  limit?: number
  status?: PushStatus
  pushType?: PushType
  keyword?: string
  createdBy?: string
}

export interface ListResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

async function listPushMessages(params: ListPushParams = {}): Promise<ListResponse<PushMessage>> {
  const response = await api.get('/push', { params })
  return response.data
}

async function getPushMessage(id: string): Promise<PushMessage> {
  const response = await api.get(`/push/${id}`)
  return response.data.data
}

async function createPushMessage(params: CreatePushParams): Promise<PushMessage> {
  const response = await api.post('/push', params)
  return response.data.data
}

async function updatePushMessage(id: string, params: UpdatePushParams): Promise<PushMessage> {
  const response = await api.put(`/push/${id}`, params)
  return response.data.data
}

async function cancelPushMessage(id: string): Promise<PushMessage> {
  const response = await api.post(`/push/${id}/cancel`)
  return response.data.data
}

async function retryPushMessage(id: string): Promise<PushMessage> {
  const response = await api.post(`/push/${id}/retry`)
  return response.data.data
}

async function deletePushMessage(id: string): Promise<void> {
  await api.delete(`/push/${id}`)
}

async function getStatistics(): Promise<Statistics> {
  const response = await api.get('/push/statistics')
  return response.data.data
}

async function exportPushReport(params: {
  startDate?: string
  endDate?: string
  status?: PushStatus
  pushType?: PushType
} = {}): Promise<void> {
  const response = await api.get('/reports/push/export', {
    params,
    responseType: 'blob',
  })
  
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  const filename = response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 'push_report.xlsx'
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export {
  listPushMessages,
  getPushMessage,
  createPushMessage,
  updatePushMessage,
  cancelPushMessage,
  retryPushMessage,
  deletePushMessage,
  getStatistics,
  exportPushReport,
}
