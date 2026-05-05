import { request } from './index'
import type { DashboardStatistics } from '@/types'

export async function getDashboardStatistics(): Promise<DashboardStatistics> {
  return request<DashboardStatistics>({
    method: 'GET',
    url: '/api/dashboard',
  })
}

export async function getTrendData(days: number = 30): Promise<any> {
  return request({
    method: 'GET',
    url: '/api/dashboard/trends',
    params: { days },
  })
}

export async function initSampleData(): Promise<any> {
  return request({
    method: 'POST',
    url: '/api/init-sample-data',
  })
}
