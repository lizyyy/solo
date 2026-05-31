export type RecordStatus = 'normal' | 'pending' | 'corrected' | 'duplicate';
export type RecordType = 'note' | 'result' | 'data';
export type EvidenceType = 'note' | 'confirmation' | 'model';
export type AnomalyType = 'drift' | 'unit_mismatch' | 'constraint_override' | 'late_attachment' | 'duplicate';
export type SourceType = 'teammate' | 'model' | 'manual';

export interface AnomalyReason {
  type: AnomalyType;
  description: string;
  details: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'data' | 'doc';
  arrivedLate: boolean;
  delayedHours?: number;
  url?: string;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  content: string;
  author: string;
  timestamp: string;
}

export interface StatusChange {
  id: string;
  fromStatus: RecordStatus;
  toStatus: RecordStatus;
  reason: string;
  operator: string;
  timestamp: string;
}

export interface DataRecord {
  id: string;
  source: SourceType;
  title: string;
  type: RecordType;
  status: RecordStatus;
  timestamp: string;
  author: string;
  data: {
    value?: number;
    unit?: string;
    constraints?: Record<string, unknown>;
    runId?: string;
    description?: string;
    [key: string]: unknown;
  };
  attachments: Attachment[];
  anomalyReason?: AnomalyReason;
  evidence: Evidence[];
  statusHistory: StatusChange[];
}

export interface RecordsState {
  records: DataRecord[];
  selectedRecordId: string | null;
  filterStatus: RecordStatus | 'all';
  showAnomalyPanel: boolean;
}

export type RecordsAction =
  | { type: 'SET_RECORDS'; payload: DataRecord[] }
  | { type: 'SELECT_RECORD'; payload: string | null }
  | { type: 'SET_FILTER'; payload: RecordStatus | 'all' }
  | { type: 'TOGGLE_ANOMALY_PANEL' }
  | { type: 'UPDATE_RECORD_STATUS'; payload: { id: string; status: RecordStatus; reason: string; operator: string } }
  | { type: 'ADD_EVIDENCE'; payload: { recordId: string; evidence: Omit<Evidence, 'id' | 'timestamp'> } }
  | { type: 'IMPORT_PACKET'; payload: DataRecord[] };

export const STATUS_LABELS: Record<RecordStatus, string> = {
  normal: '正常',
  pending: '待确认',
  corrected: '已更正',
  duplicate: '重复项',
};

export const TYPE_LABELS: Record<RecordType, string> = {
  note: '笔记',
  result: '结果图',
  data: '实验数据',
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  teammate: '队员提交',
  model: '模型输出',
  manual: '人工更正',
};

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  drift: '结果漂移',
  unit_mismatch: '单位混用',
  constraint_override: '约束覆盖',
  late_attachment: '晚到附件',
  duplicate: '重复记录',
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  note: '队员笔记',
  confirmation: '人工确认',
  model: '模型说明',
};
