export type CraneStatus = 'normal' | 'warning' | 'critical' | 'missing';
export type AnomalyType = 'gap' | 'outlier' | 'threshold' | 'avg_masked';

export interface InspectionRecord {
  id: string;
  craneId: string;
  craneName: string;
  date: string;
  partName: string;
  partCategory: '钢丝绳' | '制动器' | '减速器' | '限位器' | '滑轮' | '电气';
  measuredValue: number | null;
  unit: string;
  thresholdMin: number;
  thresholdMax: number;
  inspector: string;
  status: CraneStatus;
  batchId: string;
}

export interface AnomalyInfo {
  recordId: string;
  type: AnomalyType;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string[];
  relatedConclusionId?: string;
}

export interface Conclusion {
  id: string;
  title: string;
  detail: string;
  affectedRecords: string[];
  createdAt: string;
  batchId: string;
  anomalyIds: string[];
  deltaNote?: string;
}

export interface Filters {
  dateFrom: string;
  dateTo: string;
  craneIds: string[];
  categories: string[];
  statuses: CraneStatus[];
  onlyAnomaly: boolean;
}

export interface Snapshot {
  id: string;
  runAt: string;
  filters: Filters;
  recordCount: number;
  anomalyCount: number;
  note?: string;
}

export interface ResultBundle {
  batchId: string;
  generatedAt: string;
  filters: Filters;
  records: InspectionRecord[];
  anomalies: AnomalyInfo[];
  conclusions: Conclusion[];
  stats: {
    total: number;
    normal: number;
    warning: number;
    critical: number;
    missing: number;
    anomalyTotal: number;
  };
  pageSummary: string;
}

export interface PersistedNote {
  recordId: string;
  content: string;
  updatedAt: string;
  batchId?: string;
}

export interface PersistedSummary {
  batchSignature: string;
  content: string;
  updatedAt: string;
  history: { content: string; updatedAt: string; runAt: string }[];
}

export interface VersionedState {
  currentSnapshotId: string | null;
  snapshots: Snapshot[];
  notes: Record<string, PersistedNote>;
  summaries: Record<string, PersistedSummary>;
}
