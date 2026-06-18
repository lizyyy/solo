export type ReportStatus = 'draft' | 'partial' | 'complete' | 'abnormal';

export type AbnormalType = 'tide_unit_mixed' | 'result_mismatch' | 'time_mismatch' | 'other';

export type AbnormalSeverity = 'low' | 'medium' | 'high';

export type AbnormalStatus = 'pending' | 'processing' | 'resolved';

export type ChangeType = 'create' | 'update' | 'batch_add' | 'judgment_change';

export interface SeaReport {
  id: string;
  reportNo: string;
  samplingTime: string;
  seaArea: string;
  tideLevel: number;
  tideUnit: string;
  sceneLabel: string;
  sideNote: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  bottleCount: number;
}

export interface SampleBottle {
  id: string;
  reportId: string;
  bottleNo: string;
  batchNo: string;
  sequence: number;
  experimentResult: string;
  resultUnit: string;
  sampledAt: string;
  recordedAt: string;
  recorder: string;
  remark?: string;
}

export interface ChangeLog {
  id: string;
  reportId: string;
  changeType: ChangeType;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  remark: string;
  changedAt: string;
  operator: string;
}

export interface AbnormalRecord {
  id: string;
  reportId: string;
  bottleId?: string;
  abnormalType: AbnormalType;
  description: string;
  severity: AbnormalSeverity;
  status: AbnormalStatus;
  detectedAt: string;
}

export interface ReportFilters {
  keyword: string;
  seaArea: string;
  status: ReportStatus | '';
  dateRange: [string, string] | null;
  abnormalType: AbnormalType | '';
  onlyAbnormal: boolean;
}

export interface CSVColumn {
  key: string;
  title: string;
  dataIndex: string;
}
