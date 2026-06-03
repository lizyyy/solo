export type RecordStatus = "smooth" | "pending_review" | "old_caliber_supplemented"

export type ReviewStatus = "none" | "pending" | "confirmed" | "rejected"

export type StatusFilter = "all" | RecordStatus

export interface CustodyData {
  source: string
  importTime: string
  settlementDate: string
  amount: number
  currency: string
  confirmationPageRef: string
}

export interface ExRightsData {
  source?: string
  supplementTime?: string
  exRightsDate?: string
  adjustedAmount?: number
  screenshotRef?: string
  remark: string
}

export interface TimelineEvent {
  id?: string
  type: string
  timestamp: string | number
  description: string
  detail?: string
}

export interface MigrationRecord {
  id: string
  assetName: string
  assetCode: string
  custodyData: CustodyData
  exRightsData?: ExRightsData | null
  settlementCaliber: string
  originalCaliber: string
  isManualCorrection: boolean
  status: RecordStatus
  reconciliationNote: string
  previousReconciliationNote?: string
  timeline: TimelineEvent[]
  reviewStatus: ReviewStatus
}
