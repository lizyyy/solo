export type AnomalyType =
  | "tide_unit_mix"
  | "time_mismatch"
  | "missing_value"
  | "outlier_value";

export type RecordStatus =
  | "pending"
  | "confirmed"
  | "pending_info"
  | "returned";

export type TimelineEventType =
  | "import"
  | "filter"
  | "note"
  | "status_change"
  | "export"
  | "detect"
  | "sample_load";

export interface Anomaly {
  id: string;
  recordId: string;
  type: AnomalyType;
  description: string;
  resolved: boolean;
}

export interface Note {
  id: string;
  recordId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface StatusLog {
  id: string;
  recordId: string;
  fromStatus: RecordStatus;
  toStatus: RecordStatus;
  operator: string;
  createdAt: string;
}

export interface SurveyRecord {
  id: string;
  station: string;
  sampledAt: string;
  tideLevel: string;
  waterTemp: number | null;
  bleachingRate: number | null;
  status: RecordStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  anomalies: Anomaly[];
  notes: Note[];
  statusLogs: StatusLog[];
}

export interface FilterSnapshot {
  id: string;
  station?: string;
  anomalyType?: AnomalyType;
  status?: RecordStatus;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
}

export interface TimelineEvent {
  id: string;
  eventType: TimelineEventType;
  description: string;
  createdAt: string;
  operator: string;
  filterSnapshot?: FilterSnapshot;
  recordId?: string;
}

export interface AppState {
  records: SurveyRecord[];
  timeline: TimelineEvent[];
  activeFilters: FilterSnapshot;
  selectedRecordId: string | null;
  view: "workbench" | "timeline" | "review";
}

export const ANOMALY_LABEL: Record<AnomalyType, string> = {
  tide_unit_mix: "潮位单位混写",
  time_mismatch: "采样时间错位",
  missing_value: "缺失值",
  outlier_value: "数值离群",
};

export const STATUS_LABEL: Record<RecordStatus, string> = {
  pending: "待处理",
  confirmed: "已确认",
  pending_info: "待补件",
  returned: "退回",
};
