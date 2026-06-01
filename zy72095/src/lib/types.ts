export interface IntersectionData {
  id: string
  name: string
  distanceFromStart: number
  cycle: number
  greenRatio: number
  offset: number
  direction: "上行" | "下行"
}

export interface RawImportRow {
  id: string
  name: string
  distanceFromStart: string
  cycle: string
  greenRatio: string
  offset: string
  direction: string
}

export interface SpeedBandResult {
  segmentIndex: number
  fromIntersection: string
  toIntersection: string
  distance: number
  speedMin: number
  speedMax: number
  bandwidth: number
  isAnomalous: boolean
  anomalyReason?: string
}

export interface OptimizationSuggestion {
  intersectionId: string
  intersectionName: string
  field: "offset" | "greenRatio"
  currentValue: number
  suggestedValue: number
  reason: string
  impactOnBandwidth: number
}

export interface ValidationResult {
  id: string
  type: "empty" | "duplicate" | "unit_mismatch" | "conflict" | "boundary"
  rowIndex: number
  field: string
  message: string
  paramTableValue?: string
  importedValue?: string
  suggestion: string
}

export interface ManualAdjustment {
  intersectionId: string
  field: "offset" | "greenRatio" | "cycle" | "distanceFromStart"
  originalValue: number
  adjustedValue: number
  timestamp: string
}

export type ConflictResolution = "paramTable" | "imported"

export interface ConflictChoice {
  validationResultId: string
  resolution: ConflictResolution
}
