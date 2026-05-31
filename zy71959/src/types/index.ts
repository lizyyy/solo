export type RouteStatus = "normal" | "pending" | "abnormal"
export type AnomalyType = "battery_cycle_error" | "return_point_lost" | "no_fly_zone_edge"
export type AnomalyStatus = "pending" | "confirmed" | "rejected"
export type ReturnPointStatus = "ok" | "lost" | "low_altitude"
export type ImportMode = "overwrite" | "append"

export interface PVRoute {
  id: string
  name: string
  date: string
  status: RouteStatus
  batteryCycles: number
  expectedCycles: number
  flightDuration: number
  returnPointStatus: ReturnPointStatus
  noFlyZoneDistance: number
  pilot: string
  inspector: string
  safetyOfficer: string
}

export interface InspectionPhoto {
  id: string
  routeId: string
  url: string
  exifData: string
  linkedConclusion: string
  timestamp: string
  anomalyType?: AnomalyType
}

export interface AnomalyRecord {
  id: string
  routeId: string
  type: AnomalyType
  status: AnomalyStatus
  description: string
  detectionReason: string
  reviewReason: string
  reviewer: string
  reviewDate: string
  sourceLinks: string[]
}

export interface KMLTrack {
  id: string
  routeId: string
  coordinates: [number, number][]
  anomalyPoints: { index: number; type: AnomalyType }[]
}

export interface ImportHistory {
  id: string
  timestamp: string
  mode: ImportMode
  routeIds: string[]
  routeCount: number
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  battery_cycle_error: "电池循环错算",
  return_point_lost: "返航点丢失",
  no_fly_zone_edge: "禁飞区擦边",
}

export const STATUS_LABELS: Record<RouteStatus, string> = {
  normal: "正常",
  pending: "待确认",
  abnormal: "异常",
}

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  pending: "待确认",
  confirmed: "已确认",
  rejected: "已驳回",
}
