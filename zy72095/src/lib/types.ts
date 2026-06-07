export interface IntersectionData {
  id: string
  name: string
  distanceFromStart: number
  cycle: number
  greenRatio: number
  offset: number
  direction: "上行" | "下行"
  sourceRow: number
  sourceFile: string
}

export interface RawImportRow {
  id: string
  name: string
  distanceFromStart: string
  cycle: string
  greenRatio: string
  offset: string
  direction: string
  sourceRow: number
  sourceFile: string
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

export type FieldKey = "id" | "name" | "distanceFromStart" | "cycle" | "greenRatio" | "offset" | "direction"

export interface ColumnMapping {
  fileColumn: string
  fieldKey: FieldKey | ""
}

export const FIELD_DEFINITIONS: { key: FieldKey; label: string; aliases: string[] }[] = [
  { key: "id", label: "路口编号", aliases: ["编号", "ID", "id", "路口ID", "路口id", "交叉口编号"] },
  { key: "name", label: "路口名称", aliases: ["名称", "NAME", "name", "路口名", "交叉口名称", "交叉口名"] },
  { key: "distanceFromStart", label: "距起点距离", aliases: ["距离", "distance", "DIST", "距起点", "起点距离(m)", "距起点(m)"] },
  { key: "cycle", label: "周期", aliases: ["CYCLE", "cycle", "信号周期", "公共周期", "周期(s)"] },
  { key: "greenRatio", label: "绿信比", aliases: ["绿信比", "GREEN", "green", "greenRatio", "绿信比(%)"] },
  { key: "offset", label: "偏移量", aliases: ["偏移", "OFFSET", "offset", "相位差", "偏移量(s)"] },
  { key: "direction", label: "方向", aliases: ["DIRECTION", "direction", "行驶方向", "行进方向"] },
]
