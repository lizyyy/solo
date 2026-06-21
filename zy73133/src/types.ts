// 站点状态
export type StationStatus = 'normal' | 'pending' | 'exception';

// 站点记录（对应后端 annotation_to_station_record 输出）
export interface StationRecord {
  log_id: string;
  record_id: string;
  annotation_id: string;
  station_name: string;

  // 可为 null 表示解析失败
  latitude: number | null;
  longitude: number | null;
  latitude_raw: string;
  longitude_raw: string;
  coordinate_format: string;
  parse_notes: string[];

  // 可为 null 表示解析失败
  tide_meters: number | null;
  tide_original: string;
  tide_unit_raw: string;
  tide_level: string;
  tide_normalize_notes: string[];

  status: StationStatus;
  status_reasons: string[];
  judgment_impact: string[];

  // 三源文本（前端只读不拼装）
  scene_annotation: string;
  side_note: string;
  csv_row: Record<string, string>;

  raw_text: string;
  source_ref: string;
  timestamp: string;
  remarks: string[];
  has_exception: boolean;
}

// 单条字段变更
export interface DeltaItem {
  field_changed: string;
  old_value: unknown;
  new_value: unknown;
  judgment_impact: string;
}

// 某站点的版本变更报告
export interface DeltaReport {
  version_id: string;
  annotation_id: string;
  version_number: number;
  applied_remark: string;
  created_at: string;
  deltas: DeltaItem[];
}

// 统计数据
export interface Stats {
  total: number;
  normal: number;
  pending: number;
  exception: number;
  same_count: number;
  changed_count: number;
  still_pending: number;
}

// 批次响应（batch_to_api_response 输出）
export interface BatchResponse {
  batch_id: string;
  stations: StationRecord[];
  deltas: DeltaReport[];
  exports: Record<string, string>;
  stats: Stats;
  processed_at: string;
  has_exceptions: boolean;
  source_files: string[];
}

// 接班验证 - 单步
export interface VerifyStep {
  name: string;
  passed: boolean;
  detail: string;
}

// 接班验证 - 结果
export interface VerifyResult {
  passed: boolean;
  steps: VerifyStep[];
  errors: string[];
  summary: string;
}

// 详情面板右侧标签
export type RightTab = 'scene' | 'side' | 'csv' | 'delta';

// 应用备注请求体项
export interface RemarkInput {
  station_name?: string;
  log_id?: string;
  annotation_id?: string;
  remark_text: string;
}
