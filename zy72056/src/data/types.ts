export type DeviceType = "entrance" | "exit" | "escalator" | "elevator" | "gate" | "corridor" | "camera"

export type QualityFlagType = "offset" | "duplicate" | "missing_photo" | "cross_floor"

export type QualityStatus = "ok" | "warning" | "error"

export type AuditAction = "filter" | "select" | "annotate" | "correct" | "export" | "supplement"

export interface QualityFlag {
  type: QualityFlagType
  description: string
  relatedIds?: string[]
  resolved: boolean
  resolvedNote?: string
}

export interface StationPoint {
  id: string
  name: string
  floor: string
  type: DeviceType
  x: number
  y: number
  congestion: number
  photo?: string
  rawNote: string
  qualityFlags: QualityFlag[]
  lastModified: string
  supplements: SupplementRecord[]
}

export interface SupplementRecord {
  id: string
  timestamp: string
  content: string
  field: string
  oldValue: string
  newValue: string
}

export interface TimeSlot {
  hour: number
  points: { id: string; congestion: number }[]
}

export interface AuditLog {
  id: string
  timestamp: string
  action: AuditAction
  targetId?: string
  details: string
  snapshot?: Record<string, unknown>
}

export interface FilterState {
  floors: string[]
  types: DeviceType[]
  qualityStatus: QualityStatus[]
  timeHour: number
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  entrance: "入口",
  exit: "出口",
  escalator: "扶梯",
  elevator: "电梯",
  gate: "闸机",
  corridor: "通道",
  camera: "摄像头",
}

export const QUALITY_FLAG_LABELS: Record<QualityFlagType, string> = {
  offset: "坐标偏移",
  duplicate: "疑似重名",
  missing_photo: "缺照片",
  cross_floor: "跨楼层异常",
}

export const QUALITY_STATUS_COLORS: Record<QualityStatus, string> = {
  ok: "#22C55E",
  warning: "#F0A500",
  error: "#FF4444",
}

export const CONGESTION_COLORS = [
  { pos: 0.0, color: [0.1, 0.3, 0.8] },
  { pos: 0.3, color: [0.1, 0.7, 0.3] },
  { pos: 0.6, color: [0.9, 0.8, 0.1] },
  { pos: 0.85, color: [0.9, 0.3, 0.1] },
  { pos: 1.0, color: [0.9, 0.1, 0.1] },
]
