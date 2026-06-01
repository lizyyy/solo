export type SourceType = 'gis' | 'inspection' | 'excel' | 'manual';

export interface SourceInfo {
  type: SourceType
  fileName: string
  originalNotes: string
  importTime: string
}

export interface FieldMapping {
  delta?: string
  gamma?: string
  theta?: string
  vega?: string
  rho?: string
  label?: string
  strike?: string
  maturity?: string
}

export interface MappedValues {
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
  rho?: number
  label?: string
  strike?: number
  maturity?: string
}

export interface AnomalyInfo {
  isAnomaly: boolean
  anomalyType?: string
  detectedAt?: string
}

export interface Note {
  id: string
  content: string
  author: string
  createdAt: string
  isSupplemental: boolean
}

export interface DataRecord {
  id: string
  raw: Record<string, unknown>
  mapped: MappedValues
  source: SourceInfo
  anomaly: AnomalyInfo
  notes: Note[]
}

export type Range = [number, number]

export interface FilterState {
  deltaRange: Range
  gammaRange: Range
  thetaRange: Range
  vegaRange: Range
  sourceTypes: SourceType[]
  anomalyOnly: boolean
}

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
}

export interface ViewScheme {
  id: string
  name: string
  createdAt: string
  camera: CameraState
  filters: FilterState
  annotationSnapshot: Record<string, string>
}

export type GreekAxis = 'delta' | 'gamma' | 'theta' | 'vega'

export interface AxisMapping {
  x: GreekAxis
  y: GreekAxis
  z: GreekAxis
}
