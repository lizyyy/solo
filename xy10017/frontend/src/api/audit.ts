import { api } from './http'
import type { AuditLog, AuditAction, ResourceType } from '@/types'

export interface ListAuditParams {
  page?: number
  limit?: number
  action?: AuditAction
  userId?: string
  resourceType?: ResourceType
  resourceId?: string
  startDate?: string
  endDate?: string
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

async function listAuditLogs(params: ListAuditParams = {}): Promise<ListResponse<AuditLog>> {
  const response = await api.get('/audit', { params })
  return response.data
}

async function exportAuditReport(params: {
  startDate?: string
  endDate?: string
  action?: AuditAction
  userId?: string
} = {}): Promise<void> {
  const response = await api.get('/reports/audit/export', {
    params,
    responseType: 'blob',
  })
  
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  const filename = response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 'audit_report.xlsx'
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export {
  listAuditLogs,
  exportAuditReport,
}
