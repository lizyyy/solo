export type RecordStatus = "confirmed" | "pending" | "manual_corrected"

export type FileType = "authorization" | "asset_pack" | "layout_draft"

export interface LinkedFile {
  id: string
  name: string
  type: FileType
  uploadDate: string
  isLateArrival: boolean
  isDuplicate: boolean
}

export interface CommissionRecord {
  id: string
  title: string
  date: string
  status: RecordStatus
  linkedFiles: LinkedFile[]
  correctionNote?: string
  processingCaliber?: string
}

export interface DeliveryGroup {
  status: RecordStatus
  label: string
  records: CommissionRecord[]
  caliber: string
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  confirmed: "已确认",
  pending: "待补",
  manual_corrected: "人工改过",
}

export const STATUS_COLORS: Record<RecordStatus, string> = {
  confirmed: "#7BA37E",
  pending: "#D4A843",
  manual_corrected: "#C75C5C",
}

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  authorization: "授权文件",
  asset_pack: "素材包",
  layout_draft: "版式稿",
}

export const FILE_TYPE_ICONS: Record<FileType, string> = {
  authorization: "ShieldCheck",
  asset_pack: "Package",
  layout_draft: "Layout",
}
