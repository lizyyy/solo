export type RecordCategory = 'supplement' | 'conclusion_changed' | 'confirmed'

export type SupplementReason = 'config_early' | 'log_late'

export type RecordStatus = 'confirmed' | 'pending_supplement' | 'manually_modified'

export type ExportFormat = 'json' | 'csv'

export interface InspectionRecord {
  id: string
  linkUrl: string
  linkName: string
  category: RecordCategory
  status: RecordStatus
  judgmentReason: string
  nextStep: string
  supplementReason?: SupplementReason
  supplementDetail?: string
  beforeChange?: string
  afterChange?: string
  changeNote?: string
  processingStandard: string
  inspectedAt: string
  confirmedAt?: string
}

export interface InspectionSummary {
  total: number
  autoJudged: number
  pendingManual: number
  confirmed: number
  pendingSupplement: number
  manuallyModified: number
}

export type FilterType = 'all' | 'supplement' | 'conclusion_changed' | 'confirmed'
