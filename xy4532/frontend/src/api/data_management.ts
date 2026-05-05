import { request } from './index'
import type { SCADAAllarm, WorkOrder, RiskLevel } from '@/types'

// ========== SCADA 告警 ==========
export interface AlarmListParams {
  turbine_id?: number
  is_active?: boolean
  severity?: string
  skip?: number
  limit?: number
}

export interface AlarmListResponse {
  total: number
  items: SCADAAllarm[]
}

export async function getAlarms(params?: AlarmListParams): Promise<AlarmListResponse> {
  return request<AlarmListResponse>({
    method: 'GET',
    url: '/api/data/alarms',
    params,
  })
}

export async function createAlarm(data: Partial<SCADAAllarm> & { turbine_id: number }): Promise<SCADAAllarm> {
  return request<SCADAAllarm>({
    method: 'POST',
    url: '/api/data/alarms',
    data,
  })
}

export async function batchImportAlarms(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  
  return request({
    method: 'POST',
    url: '/api/data/alarms/batch-import',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export async function resolveAlarm(id: number, resolution?: string): Promise<void> {
  const formData = new FormData()
  if (resolution) {
    formData.append('resolution', resolution)
  }
  
  return request({
    method: 'PUT',
    url: `/api/data/alarms/${id}/resolve`,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

// ========== 维修工单 ==========
export interface WorkOrderListParams {
  turbine_id?: number
  status?: string
  priority?: string
  skip?: number
  limit?: number
}

export interface WorkOrderListResponse {
  total: number
  items: WorkOrder[]
}

export async function getWorkOrders(params?: WorkOrderListParams): Promise<WorkOrderListResponse> {
  return request<WorkOrderListResponse>({
    method: 'GET',
    url: '/api/data/work-orders',
    params,
  })
}

export async function createWorkOrder(data: Partial<WorkOrder> & { turbine_id: number }): Promise<WorkOrder> {
  return request<WorkOrder>({
    method: 'POST',
    url: '/api/data/work-orders',
    data,
  })
}

export async function batchImportWorkOrders(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  
  return request({
    method: 'POST',
    url: '/api/data/work-orders/batch-import',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export async function completeWorkOrder(id: number, resolution: string): Promise<void> {
  const formData = new FormData()
  formData.append('resolution', resolution)
  
  return request({
    method: 'PUT',
    url: `/api/data/work-orders/${id}/complete`,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

// ========== 数据导出 ==========
export interface ExportRequest {
  turbine_ids?: number[]
  risk_levels?: RiskLevel[]
  include_photos?: boolean
  include_alarms?: boolean
  include_work_orders?: boolean
}

export async function exportMarkdown(params: ExportRequest): Promise<{ file_name: string; file_path: string; assessment_count: number }> {
  return request({
    method: 'POST',
    url: '/api/data/export/markdown',
    data: params,
  })
}

export async function exportJson(params: ExportRequest): Promise<{ file_name: string; file_path: string; assessment_count: number }> {
  return request({
    method: 'POST',
    url: '/api/data/export/json',
    data: params,
  })
}
