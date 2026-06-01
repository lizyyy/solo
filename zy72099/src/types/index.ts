export interface ExhibitPoint {
  id: string
  name: string
  x: number | null
  y: number | null
  floor: number
  estimatedStayMinutes: number | null
  unit: 'm' | 'ft'
  category: string
}

export interface ValidationResult {
  pointId: string
  status: 'valid' | 'warning' | 'uncalculable'
  reasons: string[]
}

export interface OptimizationStep {
  step: number
  title: string
  description: string
  data: Record<string, unknown>
}

export interface ExcludedPoint {
  pointId: string
  reason: string
}

export interface Prediction {
  suggestion: string
  reasoning: string
  confidence: number
}

export interface OptimizationResult {
  route: string[]
  totalDistance: number
  totalDistanceUnit: string
  estimatedTime: number
  reasoning: OptimizationStep[]
  excludedPoints: ExcludedPoint[]
  predictions: Prediction[]
}

export interface Supplement {
  id: string
  pointId: string
  field: string
  oldValue: string
  newValue: string
  note: string
  timestamp: string
}

export interface Conflict {
  id: string
  summaryClaim: string
  dataEvidence: string
  suggestedAction: string
}

export type ValidationCategory = 'null_value' | 'duplicate' | 'unit_mismatch' | 'suspicious' | 'none'
