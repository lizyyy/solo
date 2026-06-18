export type AnomalyType = 'TEMP_ANOMALY' | 'SALINITY_ANOMALY' | 'DO_ANOMALY' | 'PH_ANOMALY' | 'MULTI_ANOMALY'

export type RecordStatus = 'UNCONFIRMED' | 'CONFIRMED' | 'SUSPENDED' | 'RESOLVED'

export interface AnomalyRecord {
  id: string
  buoyId: string
  sensorTimestamp: string
  sensorLat: number
  sensorLng: number
  waterTemp: number
  salinity: number
  dissolvedOxygen: number
  phValue: number
  anomalyType: AnomalyType
  status: RecordStatus
  createdAt: string
  updatedAt: string
}

export interface ShipRecord {
  id: string
  buoyId: string
  recordTimestamp: string
  recordLat: number
  recordLng: number
  waterTemp: number
  salinity: number
  dissolvedOxygen: number
  phValue: number
  isBoundarySample: boolean
  linkedAnomalyId: string
}

export interface Remark {
  id: string
  recordId: string
  author: string
  content: string
  createdAt: string
}

export interface FilterProfile {
  buoyId: string
  anomalyType: AnomalyType | ''
  status: RecordStatus | ''
  dateFrom: string
  dateTo: string
  applyToExport: boolean
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  TEMP_ANOMALY: '水温异常',
  SALINITY_ANOMALY: '盐度异常',
  DO_ANOMALY: '溶解氧异常',
  PH_ANOMALY: 'pH异常',
  MULTI_ANOMALY: '多重异常',
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  UNCONFIRMED: '未确认',
  CONFIRMED: '已确认',
  SUSPENDED: '挂起待确认',
  RESOLVED: '已解决',
}
