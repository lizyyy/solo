export type PressureUnit = 'Pa' | 'dB' | 'm/s'
export type DataSource = 'import' | 'supplement'
export type DiagnosisLevel = 'safe' | 'warn' | 'danger'

export interface SensorRecord {
  id: string
  timestamp: string
  frequency: number
  soundPressure: number
  unit: PressureUnit
  rawValue: string
  isGap: boolean
  isDuplicate: boolean
  isEmpty: boolean
  source: DataSource
}

export interface ThresholdBand {
  frequencyRange: [number, number]
  safeMax: number
  warnMax: number
  dangerMax: number
  unit: 'Pa' | 'dB'
}

export interface ThresholdVersion {
  version: number
  createdAt: string
  modifiedBy: string
  reason: string
  bands: ThresholdBand[]
}

export interface DiagnosisResult {
  id: string
  recordId: string
  level: DiagnosisLevel
  frequency: number
  measuredValue: number
  convertedValue: number
  convertedUnit: PressureUnit
  thresholdUsed: number
  thresholdVersion: number
  note: string
}

export interface RoomDimensions {
  length: number
  width: number
  height: number
}

export interface StandingWaveMode {
  order: number
  axis: 'L' | 'W' | 'H'
  frequency: number
  label: string
}

export interface GapInterval {
  start: string
  end: string
  durationSeconds: number
}

export interface DiagnosisReport {
  id: string
  createdAt: string
  thresholdVersion: number
  roomDimensions: RoomDimensions
  results: DiagnosisResult[]
  gapIntervals: GapInterval[]
  modes: StandingWaveMode[]
  summary: {
    safe: number
    warn: number
    danger: number
  }
}

export interface UnitConversion {
  from: PressureUnit
  to: PressureUnit
  fromValue: number
  toValue: number
  formula: string
}
