export interface StationRecord {
  id: string
  station_code: string
  station_name: string
  lng: number
  lat: number
  energy_output: number
  sampling_time: string
  expected_time: string
  time_conflict: boolean
  experiment_result: string
  result_value: number
  threshold_min: number
  threshold_max: number
  result_abnormal: boolean
  anomaly_reason: string
  remote_sensing_source: string
  screenshot_id: string
  source_line: string
  cloud_impact: '无' | '部分' | '严重'
  cloud_area_desc: string
  batch_id: string
  status: '原始' | '已核对' | '已修正'
  remark: string
  updated_at: string
  derived_from?: string
}

export type ViewMode = 'global' | 'anomaly' | 'batch'

export type AnomalyFilterKey = 'cloud_heavy' | 'time_conflict' | 'result_abnormal'

export interface FieldChange {
  field: string
  old: unknown
  new: unknown
}

export interface StationDiff {
  station_code: string
  changes: FieldChange[]
}

export interface ExportPayload {
  exportedAt: string
  records: StationRecord[]
  originalRecords: StationRecord[]
  diff: StationDiff[]
}

export interface StationStoreState {
  records: StationRecord[]
  viewMode: ViewMode
  searchKeyword: string
  selectedId: string | null
  showExportPanel: boolean
  setViewMode: (mode: ViewMode) => void
  setSearchKeyword: (kw: string) => void
  selectStation: (id: string | null) => void
  setShowExportPanel: (v: boolean) => void
  updateRemark: (id: string, remark: string) => void
  getLatestByStation: () => StationRecord[]
}
