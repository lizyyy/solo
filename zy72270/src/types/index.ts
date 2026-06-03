export type RecordStatus = "normal" | "pending_review" | "supplemented" | "conflict" | "rejected"

export type SlopeGrade = "beginner" | "intermediate" | "advanced" | "expert"

export type SourceType = "rangefinder" | "obstacle_remark" | "manual_supplement"

export interface PhotoPoint {
  id: string
  recordId: string
  sequenceNumber: number
  photoUrl: string
  longitude: number
  latitude: number
}

export interface CoordinateRow {
  id: string
  recordId: string
  sequenceNumber: number
  longitude: number
  latitude: number
  elevation: number
}

export interface RangefinderRecord {
  id: string
  importBatchId: string
  importTime: string
  operator: string
  status: RecordStatus
  photoPoints: PhotoPoint[]
  coordinateRows: CoordinateRow[]
  slopeName: string
}

export interface RemarkEntry {
  id: string
  remarkId: string
  sequenceNumber: number
  longitude: number
  latitude: number
  description: string
}

export interface ObstacleRemark {
  id: string
  recordId: string
  remarkText: string
  source: string
  recordedAt: string
  entries: RemarkEntry[]
}

export interface ConflictEvidence {
  field: string
  rangefinderValue: string
  remarkValue: string
  timestamp: string
}

export interface ApprovalAction {
  action: "confirm" | "reject"
  operator: string
  reason: string
  timestamp: string
}

export interface ObstructionPoint {
  id: string
  label: string
  longitude: number
  latitude: number
  status: RecordStatus
  sourceType: SourceType
  confirmedBy: string
  confirmedAt: string
  reason: string
  recordId: string
}

export interface ObstructionHistory {
  id: string
  pointId: string
  action: string
  operator: string
  timestamp: string
  detail: string
}

export interface GradingResult {
  id: string
  pointId: string
  slopeName: string
  slopeGrade: SlopeGrade
  slopeAngle: number
  paramVersion: string
  modelVersion: string
  tradeoffReason: string
  calculatedAt: string
}

export interface ValidationResult {
  recordId: string
  type: "normal" | "missing_coordinate" | "supplement_mismatch"
  description: string
  missingSequenceNumbers: number[]
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  normal: "正常",
  pending_review: "待复核",
  supplemented: "已补录",
  conflict: "冲突",
  rejected: "已驳回",
}

export const GRADE_LABELS: Record<SlopeGrade, string> = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
  expert: "专家",
}

export const GRADE_COLORS: Record<SlopeGrade, string> = {
  beginner: "bg-green-400",
  intermediate: "bg-blue-400",
  advanced: "bg-frost-500",
  expert: "bg-rose-500",
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  rangefinder: "测距仪",
  obstacle_remark: "障碍物备注",
  manual_supplement: "手动补录",
}
