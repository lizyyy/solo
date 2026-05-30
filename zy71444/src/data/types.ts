export interface ClientAccount {
  id: string
  name: string
  code: string
}

export interface OptionPosition {
  id: string
  clientId: string
  underlying: string
  strike: number
  direction: "CALL" | "PUT"
  quantity: number
  expiryDate: string
  expiryBucket: string
  delta: number
  gamma: number
  vega: number
  notional: number
  deltaSignReversal: boolean
  bucketMismatch: boolean
}

export interface ExpiryBucket {
  id: string
  label: string
  month: string
  color: string
}

export interface AggregatedExposure {
  clientId: string
  clientName: string
  clientCode: string
  bucketId: string
  bucketLabel: string
  bucketColor: string
  delta: number
  gamma: number
  vega: number
  positions: OptionPosition[]
  intermediateSteps: IntermediateStep[]
  hasAnomaly: boolean
  anomalyType: ("BUCKET_MISMATCH" | "SIGN_REVERSAL")[]
}

export interface IntermediateStep {
  step: string
  description: string
  inputValues: Record<string, number>
  outputValue: number
  threshold?: number
  reasoning?: string
}

export interface AuditLogEntry {
  id: string
  timestamp: number
  action: string
  summary: string
  context: AuditContext
  snapshot: ViewSnapshot
}

export interface AuditContext {
  activeGreeks: ("delta" | "gamma" | "vega")[]
  activeBuckets: string[]
  thresholdValue: number
  selectedClientId: string | null
}

export interface ViewSnapshot {
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  filterState: AuditContext
  highlightedIds: string[]
}

export type GreekKey = "delta" | "gamma" | "vega"
