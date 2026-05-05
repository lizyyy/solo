import { request } from './index'
import type { WindTurbine, Blade, InspectionRecord, SCADAAllarm, WorkOrder } from '@/types'

export interface TurbineListParams {
  skip?: number
  limit?: number
  status?: string
}

export interface TurbineListResponse {
  total: number
  items: WindTurbine[]
}

export async function getTurbines(params?: TurbineListParams): Promise<TurbineListResponse> {
  return request<TurbineListResponse>({
    method: 'GET',
    url: '/api/turbines/',
    params,
  })
}

export async function getTurbine(id: number): Promise<WindTurbine> {
  return request<WindTurbine>({
    method: 'GET',
    url: `/api/turbines/${id}`,
  })
}

export async function createTurbine(data: Partial<WindTurbine>): Promise<WindTurbine> {
  return request<WindTurbine>({
    method: 'POST',
    url: '/api/turbines/',
    data,
  })
}

export async function updateTurbine(id: number, data: Partial<WindTurbine>): Promise<WindTurbine> {
  return request<WindTurbine>({
    method: 'PUT',
    url: `/api/turbines/${id}`,
    data,
  })
}

export async function deleteTurbine(id: number): Promise<void> {
  return request({
    method: 'DELETE',
    url: `/api/turbines/${id}`,
  })
}

export async function getTurbineBlades(turbineId: number): Promise<Blade[]> {
  return request<Blade[]>({
    method: 'GET',
    url: `/api/turbines/${turbineId}/blades`,
  })
}

export async function getTurbineInspections(turbineId: number, params?: { skip?: number; limit?: number }): Promise<{ total: number; items: InspectionRecord[] }> {
  return request({
    method: 'GET',
    url: `/api/turbines/${turbineId}/inspections`,
    params,
  })
}

export async function getTurbineAlarms(turbineId: number, params?: { is_active?: boolean; skip?: number; limit?: number }): Promise<{ total: number; items: SCADAAllarm[] }> {
  return request({
    method: 'GET',
    url: `/api/turbines/${turbineId}/alarms`,
    params,
  })
}

export async function getTurbineWorkOrders(turbineId: number, params?: { status?: string; skip?: number; limit?: number }): Promise<{ total: number; items: WorkOrder[] }> {
  return request({
    method: 'GET',
    url: `/api/turbines/${turbineId}/work-orders`,
    params,
  })
}
