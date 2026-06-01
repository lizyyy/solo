export type ForceUnit = "kN" | "N" | "lbf" | "kgf"
export type DataSource = "manual" | "sensor_log" | "legacy_supplement"
export type JudgmentStatus = "pass" | "confirm" | "exceed"

export interface RawDataPoint {
  sampleIndex: number
  value: number | null
  unit: ForceUnit
  isGap: boolean
  interpolated: boolean
}

export interface ProcessedDataPoint {
  sampleIndex: number
  valueKilonewtons: number
  originalUnit: ForceUnit
  originalValue: number
  wasInterpolated: boolean
}

export interface CalculationParams {
  waterDensity: number
  airDensity: number
  dragCoeffCurrent: number
  inertiaCoeff: number
  dragCoeffWind: number
  submergedArea: number
  aerialArea: number
  currentVelocity: number
  waveAcceleration: number
  windVelocity: number
}

export interface ForceResult {
  measuredPeakKN: number
  measuredAvgKN: number
  theoreticalTotalKN: number
  theoreticalCurrentKN: number
  theoreticalWaveKN: number
  theoreticalWindKN: number
  formulaUsed: string
  paramsUsed: CalculationParams
  deviationNote: string
}

export interface Judgment {
  status: JudgmentStatus
  statusLabel: string
  reason: string
  thresholdVersion: string
  thresholdValueKN: number
  ratioToThreshold: number
  judgedAt: string
}

export interface MooringRecord {
  id: string
  label: string
  source: DataSource
  sourceNote: string
  timestamp: string
  rawData: RawDataPoint[]
  processedData: ProcessedDataPoint[]
  forceResult: ForceResult
  judgment: Judgment
}

export interface ThresholdVersion {
  version: string
  valueKN: number
  changedAt: string
  changeReason: string
}

export interface Report {
  reportId: string
  generatedAt: string
  thresholdAtGeneration: ThresholdVersion
  records: MooringRecord[]
}
