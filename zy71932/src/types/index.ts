export type LicenseType = '商业' | '个人' | '开源' | '自定义'
export type RecordStatus = 'confirmed' | 'pending' | 'expired' | 'conflict'
export type LogAction = 'import' | 'update' | 'confirm' | 'revoke' | 'merge' | 'skip' | 'export'
export type ImportSessionStatus = 'preview' | 'processing' | 'completed' | 'cancelled'
export type ConflictResolution = 'merge' | 'overwrite' | 'skip'

export interface ColorCard {
  id: string
  name: string
  version: string
  colorValues: { hex: string; name: string }[]
  createdAt: string
}

export interface ReviewNote {
  id: string
  content: string
  author: string
  createdAt: string
  resolved: boolean
}

export interface FontRecord {
  id: string
  fontName: string
  foundry: string
  licenseType: LicenseType
  licenseFile?: string
  expiryDate?: string
  usageScope?: string
  colorCardId?: string
  colorCardVersion?: string
  status: RecordStatus
  reviewNotes: ReviewNote[]
  customNotes: string
  createdAt: string
  updatedAt: string
  sourceImportId?: string
}

export interface OperationLog {
  id: string
  recordId: string
  action: LogAction
  previousValue?: { [key: string]: unknown }
  newValue?: { [key: string]: unknown }
  operator: string
  timestamp: string
  detail: string
}

export interface ExportSnapshot {
  id: string
  timestamp: string
  filterCriteria: Record<string, string[]>
  recordCount: number
  anomalyCount: number
  deliveryNote: string
  operator: string
  recordIds: string[]
}

export interface ImportSession {
  id: string
  timestamp: string
  fileName: string
  totalRows: number
  newCount: number
  updateCount: number
  conflictCount: number
  skipCount: number
  status: ImportSessionStatus
}

export interface ImportRow {
  fontName: string
  foundry: string
  licenseType: string
  expiryDate?: string
  usageScope?: string
  colorCardName?: string
  colorCardVersion?: string
  customNotes?: string
}

export interface ConflictItem {
  importRow: ImportRow
  existingRecord: FontRecord
  resolution?: ConflictResolution
  index: number
}

export interface AnomalyItem {
  id: string
  recordId: string
  reason: string
  type: 'expired' | 'spec_mismatch' | 'color_mismatch' | 'missing_field'
}

export interface ExportFilter {
  statuses: RecordStatus[]
  licenseTypes: LicenseType[]
  colorCardIds: string[]
  expiryRange?: { start: string; end: string }
  search: string
}
