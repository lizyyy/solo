export type PumpStatus = 'normal' | 'warning' | 'critical' | 'suspended' | 'pending_confirm'
export type ShiftType = 'morning' | 'afternoon' | 'night'
export type RecordSource = 'routine' | 'supplement' | 'rerun'

export interface ThresholdConfig {
  vibration: { min: number; max: number; warningMin: number; warningMax: number }
  temperature: { min: number; max: number; warningMin: number; warningMax: number }
  pressure: { min: number; max: number; warningMin: number; warningMax: number }
  flowRate: { min: number; max: number; warningMin: number; warningMax: number }
  current: { min: number; max: number; warningMin: number; warningMax: number }
}

export interface MetricValue {
  vibration: number
  temperature: number
  pressure: number
  flowRate: number
  current: number
}

export interface PartInfo {
  name: string
  model: string
  replaced: boolean
  originalModel?: string
  newModel?: string
  replaceTime?: string
  confirmedBy?: string
  confirmedAt?: string
}

export interface ChangeRecord {
  id: string
  inspectionId: string
  field: string
  oldValue: string
  newValue: string
  operator: string
  operatorRole: string
  changeTime: string
  shift: ShiftType
  reason?: string
}

export interface NoteRecord {
  id: string
  inspectionId: string
  content: string
  author: string
  authorRole: string
  createTime: string
  affectedJudgments: string[]
  screenshotRefs?: string[]
}

export interface Screenshot {
  id: string
  inspectionId: string
  name: string
  dataUrl: string
  uploadTime: string
  description?: string
}

export interface AlertPoint {
  metric: keyof MetricValue
  metricLabel: string
  value: number
  thresholdMin: number
  thresholdMax: number
  level: 'warning' | 'critical'
  formula: string
  inspectionId: string
}

export interface Inspection {
  id: string
  pumpId: string
  pumpName: string
  inspectionDate: string
  shift: ShiftType
  inspector: string
  source: RecordSource
  parentId?: string
  rerunCount: number
  status: PumpStatus
  metrics: MetricValue
  parts: PartInfo[]
  alerts: AlertPoint[]
  calcFormulaVersion: string
  calcNotes: string
  createTime: string
  updateTime: string
}

export interface ExportHistory {
  id: string
  inspectionIds: string[]
  exportTime: string
  operator: string
  formulaVersion: string
  hash: string
}
