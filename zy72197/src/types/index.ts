export type SampleStatus = "model_judged" | "human_corrected" | "needs_review" | "duplicate"
export type SampleSource = "线上反馈工单" | "历史补录" | "主动采集"

export interface Sample {
  id: string
  source: SampleSource
  sourceId: string
  content: string
  originalLabel: string
  modelLabel: string | null
  finalLabel: string | null
  status: SampleStatus
  replayReason: string
  importedAt: string
  processedAt: string | null
  isDuplicate: boolean
  hasConflict: boolean
  hasLeakage: boolean
  duplicateOf: string | null
}

export interface ReviewRecord {
  id: string
  sampleId: string
  previousLabel: string
  correctedLabel: string
  correctionReason: string
  reviewer: string
  reviewedAt: string
}

export interface ReplayResult {
  id: string
  sampleId: string
  modelOutput: string
  modelLabel: string
  confidence: number
  citation: string | null
  replayedAt: string
}

export interface MetricsResult {
  totalSamples: number
  modelJudgedCount: number
  humanCorrectedCount: number
  needsReviewCount: number
  modelJudgedRate: number
  humanCorrectedRate: number
  needsReviewRate: number
  conflictCount: number
  leakageCount: number
  duplicateCount: number
  missingCitationCount: number
}

export const STATUS_LABELS: Record<SampleStatus, string> = {
  model_judged: "模型判断",
  human_corrected: "人工修正",
  needs_review: "待复核",
  duplicate: "重复样本",
}

export const SOURCE_LABELS: Record<SampleSource, string> = {
  "线上反馈工单": "线上反馈工单",
  "历史补录": "历史补录",
  "主动采集": "主动采集",
}
