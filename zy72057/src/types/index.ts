export type ItemStatus = "normal" | "duplicate" | "offset" | "missing_photo" | "boundary" | "empty_value"

export interface Building {
  id: string
  name: string
  x: number
  y: number
  width: number
  depth: number
  height: number
  floor: string
  photoUrl: string
  status: ItemStatus
  anomalyNote: string
}

export interface SolarPanel {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  tiltAngle: number
  azimuth: number
  inverterId: string
  photoUrl: string
  status: ItemStatus
  anomalyNote: string
  shadowCoverage: number
}

export interface Inverter {
  id: string
  name: string
  aliasName: string
  x: number
  y: number
  floor: string
  buildingId: string
  photoUrl: string
  status: ItemStatus
  anomalyNote: string
}

export interface Scheme {
  id: string
  name: string
  latitude: number
  longitude: number
  date: string
  time: string
  sunAltitude: number
  sunAzimuth: number
  buildings: Building[]
  panels: SolarPanel[]
  inverters: Inverter[]
  createdAt: string
  updatedAt: string
  note: string
}

export type ConflictType = "coordinate_offset" | "name_mismatch" | "missing_field" | "boundary_cross"

export interface ConflictRecord {
  id: string
  type: ConflictType
  existingData: Record<string, unknown>
  importedData: Record<string, unknown>
  description: string
  suggestion: string
  resolved: boolean
  userDecision?: "keep_existing" | "use_imported" | "merge"
  entityType: "building" | "panel" | "inverter"
  entityId: string
}

export interface FilterState {
  statusFilter: ItemStatus | "all"
  typeFilter: "all" | "building" | "panel" | "inverter"
  searchText: string
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  normal: "正常",
  duplicate: "疑似重复",
  offset: "坐标偏移",
  missing_photo: "缺照片",
  boundary: "边界异常",
  empty_value: "空值",
}

export const STATUS_COLORS: Record<ItemStatus, string> = {
  normal: "#22c55e",
  duplicate: "#f97316",
  offset: "#f97316",
  missing_photo: "#94a3b8",
  boundary: "#ef4444",
  empty_value: "#94a3b8",
}
