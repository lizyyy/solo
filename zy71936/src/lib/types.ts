export type SourceType = "版式稿" | "色卡" | "其他"
export type AuthStatus = "有效" | "过期" | "未知"
export type MarkStatus = "待判断" | "已确认" | "待复核" | "授权过期"
export type ExportFormat = "csv" | "xlsx"

export interface Project {
  id: string
  name: string
  createdAt: number
  importCount: number
  specVersion: string
}

export interface PhotoRecord {
  id: string
  projectId: string
  fileName: string
  shootDate: string
  sourceType: SourceType
  authorizationStatus: AuthStatus
  authorizationExpiry: string | null
  authorizationContact: string | null
  markStatus: MarkStatus
  markReason: string
  nextStep: string
  reviewOpinion: string
  specVersion: string
  createdAt: number
  updatedAt: number
}

export interface ChangeLog {
  id: string
  photoRecordId: string
  field: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: number
  changeReason: string
}

export interface ExportSpec {
  id: string
  name: string
  columns: string[]
  format: ExportFormat
  lastUsedAt: number
}

export interface FieldMapping {
  source: string
  target: string
}

export const FIELD_OPTIONS: string[] = [
  "fileName",
  "shootDate",
  "sourceType",
  "authorizationStatus",
  "authorizationExpiry",
  "authorizationContact",
  "reviewOpinion",
  "specVersion",
  "markStatus",
  "markReason",
  "nextStep",
]

export const FIELD_LABELS: Record<string, string> = {
  fileName: "文件名",
  shootDate: "拍摄日期",
  sourceType: "来源类型",
  authorizationStatus: "授权状态",
  authorizationExpiry: "授权到期日",
  authorizationContact: "授权联系人",
  reviewOpinion: "审稿意见",
  specVersion: "规格版本",
  markStatus: "标记状态",
  markReason: "判断理由",
  nextStep: "下一步建议",
}

export const MARK_STATUS_LABELS: Record<MarkStatus, string> = {
  待判断: "待判断",
  已确认: "已确认",
  待复核: "待复核",
  授权过期: "授权过期",
}

export const SOURCE_TYPE_OPTIONS: SourceType[] = ["版式稿", "色卡", "其他"]
export const AUTH_STATUS_OPTIONS: AuthStatus[] = ["有效", "过期", "未知"]
