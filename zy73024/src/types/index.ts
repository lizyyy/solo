export type RecordSource =
  | 'official'
  | 'old_version'
  | 'name_change'
  | 'verbal'
  | 'missing_vaccine'

export type Status = 'pending' | 'reviewing' | 'processed' | 'completed'
export type AnomalyType = 'rename' | 'old_curve' | 'verbal_mismatch' | 'missing_vaccine' | 'data_conflict'
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical'

export interface Pet {
  id: string
  name: string
  aliases: string[]
  species: 'cat' | 'dog' | 'other'
  avatarEmoji: string
  startWeight: number
  currentWeight: number
  targetWeight?: number
  status: Status
  anomalyCount: number
  highAnomalyCount: number
  lastUpdatedAt: string
  reviewer?: string
  confidenceScore: number
}

export interface WeightRecord {
  id: string
  petId: string
  date: string
  weight: number
  source: RecordSource
  versionLabel?: string
  isIncluded: boolean
  note?: string
  credibility: 1 | 2 | 3 | 4 | 5
  capturedByName?: string
}

export interface Anomaly {
  id: string
  petId: string
  type: AnomalyType
  title: string
  description: string
  detectedAt: string
  level: ImpactLevel
  relatedRecordIds: string[]
  affectedConclusion: string
  status: 'open' | 'resolved'
  resolvedBy?: string
  resolvedAt?: string
  resolution?: string
}

export interface TraceNode {
  id: string
  anomalyId: string
  step: number
  type: 'original' | 'conflict' | 'analysis' | 'human_decision' | 'final'
  title: string
  detail: string
  beforeValue?: string
  afterValue?: string
  delta?: string
}

export interface ReviewDecision {
  id: string
  anomalyId: string
  petId: string
  reviewer: string
  reviewedAt: string
  reason: string
  beforeWeight: number
  afterWeight: number
  beforeRate: string
  afterRate: string
  signatureEmoji: string
}

export interface AbnormalRecordNote {
  id: string
  petId: string
  recordId: string
  title: string
  reasonWhySkipped: string
  handling: string
  impactLevel: ImpactLevel
  impactDescription: string
  impactPercent: number
}

export interface DeliveryCard {
  id: string
  petId: string
  anomalyId: string
  summaryText: string
  curveHighlight: {
    date: string
    weightDiff: string
    arrowNote: string
  }
  impactStatement: string
}
