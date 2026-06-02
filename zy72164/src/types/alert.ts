export type AlertStatus = "processed" | "pending" | "recheck"

export type SourceType = "inspection_report" | "inspection_photo" | "complaint" | "statistics"

export type ProcessAction = "confirmed" | "marked_pending" | "marked_recheck" | "opinion_added"

export interface AlertSource {
  id: string
  type: SourceType
  referenceNo: string
  description: string
  recordedAt: string
}

export interface ProcessRecord {
  id: string
  action: ProcessAction
  operator: string
  opinion: string
  processedAt: string
  isOverridden: boolean
  overriddenBy?: string
}

export interface CoordinateDrift {
  originalLng: number
  originalLat: number
  correctedLng: number
  correctedLat: number
  driftMeters: number
}

export interface TimePeriodStat {
  period: string
  weekdayAvg: number
  weekendAvg: number
  peakHour: string
}

export interface AlertPoint {
  id: string
  name: string
  lng: number
  lat: number
  status: AlertStatus
  sourceType: SourceType
  sources: AlertSource[]
  processRecords: ProcessRecord[]
  coordinateDrift?: CoordinateDrift
  duplicateComplaintIds: string[]
  timePeriodStats?: TimePeriodStat[]
  isOldCaliber: boolean
  inspectionPhotoUrls: string[]
  createdAt: string
  updatedAt: string
}

export interface AlertFilter {
  status: AlertStatus | "all"
  sourceType: SourceType | "all"
  dateRange: { start: string; end: string } | null
}
