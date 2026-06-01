export interface DataSource {
  id?: number
  type: 'lecture' | 'business_table' | 'screenshot' | 'manual'
  name: string
  description: string
  importedAt: string
}

export interface UnifiedRecord {
  id?: number
  dataSourceId: number
  originalFieldName: string
  standardFieldName: string
  originalValue: string
  originalUnit: string
  convertedValue: number
  targetUnit: string
  conversionVersionId: string
  isAnomaly: boolean
  anomalyReason: string
  routeId: string
  warehouseId: string
  temperature: number
  mileage: number
  vehicleCapacity: number
}

export interface FieldMapping {
  id?: number
  originalField: string
  standardField: string
  createdAt: string
}

export interface UnitConversion {
  id?: number
  fromUnit: string
  toUnit: string
  factor: number
  version: string
  createdAt: string
}

export interface AllocationParams {
  id?: number
  tempZoneMin: number
  tempZoneMax: number
  maxMileage: number
  vehicleCapacity: number
  versionLabel: string
  createdAt: string
}

export interface AllocationResult {
  id?: number
  paramVersionId: number
  calculatedAt: string
  routeId: string
  warehouseId: string
  vehicleId: string
  assignedTemp: number
  assignedMileage: number
  assignedLoad: number
  efficiency: number
}

export interface CalcStep {
  id?: number
  resultId: number
  stepOrder: number
  description: string
  inputValues: string
  outputValues: string
  paramVersionId: string
  isAnomaly: boolean
  anomalyReason: string
}

export interface Conflict {
  id?: number
  historicalRecordId: number
  importedRecordId: number
  conflictType: 'value_mismatch' | 'unit_mismatch' | 'field_mapping'
  historicalValue: string
  importedValue: string
  fieldName: string
  status: 'pending' | 'resolved'
}

export interface ConflictResolution {
  id?: number
  conflictId: number
  chosenSide: 'historical' | 'imported' | 'manual'
  manualValue?: string
  reason: string
  resolvedBy: string
  resolvedAt: string
}

export interface AuditLogEntry {
  id?: number
  category: 'data' | 'parameter' | 'calculation' | 'conflict' | 'report'
  action: string
  detail: string
  relatedId: string
  timestamp: string
}

export const STANDARD_FIELDS = [
  'routeId',
  'warehouseId',
  'temperature',
  'mileage',
  'vehicleCapacity',
  'productType',
  'departureTime',
  'arrivalTime',
] as const

export type StandardField = typeof STANDARD_FIELDS[number]

export const SOURCE_TYPE_LABELS: Record<DataSource['type'], string> = {
  lecture: '老师讲义',
  business_table: '业务表',
  screenshot: '截图',
  manual: '手动录入',
}

export const CONFLICT_TYPE_LABELS: Record<Conflict['conflictType'], string> = {
  value_mismatch: '数值冲突',
  unit_mismatch: '单位冲突',
  field_mapping: '字段映射冲突',
}

export const DEFAULT_UNITS: Record<string, { unit: string; alternatives: string[] }> = {
  temperature: { unit: '°C', alternatives: ['℃', '°F', 'F', 'C'] },
  mileage: { unit: 'km', alternatives: ['千米', '公里', 'mi', '英里'] },
  vehicleCapacity: { unit: '吨', alternatives: ['t', 'T', 'kg', '千克', '公斤'] },
}

export const UNIT_FACTORS: Record<string, Record<string, number>> = {
  temperature: { '°C': 1, '℃': 1, '°F': 1, 'C': 1 },
  mileage: { 'km': 1, '千米': 1, '公里': 1, 'mi': 1.60934, '英里': 1.60934 },
  vehicleCapacity: { '吨': 1, 't': 1, 'T': 1, 'kg': 0.001, '千克': 0.001, '公斤': 0.001 },
}
