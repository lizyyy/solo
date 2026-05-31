export type RecordType = 'guest' | 'clip' | 'ad';
export type RecordStatus = 'confirmed' | 'pending' | 'manual';
export type AnomalyType = 'duplicate' | 'late' | 'drift' | 'missing';

export interface TimelineRecord {
  id: string;
  type: RecordType;
  startTime: number;
  duration: number;
  title: string;
  description: string;
  status: RecordStatus;
  source: 'imported' | 'manual';
  createdAt: string;
  updatedAt: string;
  meta?: {
    speakerName?: string;
    adClient?: string;
    clipType?: string;
    importDelay?: number;
    originalId?: string;
  };
}

export interface Anomaly {
  id: string;
  recordId: string;
  type: AnomalyType;
  description: string;
  explanation?: string;
  resolved: boolean;
  resolvedAt?: string;
  relatedRecordIds?: string[];
}

export interface Correction {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  timestamp: string;
  reason: string;
}

export interface VersionSnapshot {
  id: string;
  timestamp: string;
  records: TimelineRecord[];
  anomalies: Anomaly[];
  description: string;
}

export interface DriftZone {
  startTime: number;
  endTime: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ExportItem {
  record: TimelineRecord;
  anomalies: Anomaly[];
  corrections: Correction[];
  handlingNote: string;
}

export interface ExportManifest {
  exportTime: string;
  operator: string;
  confirmed: ExportItem[];
  pending: ExportItem[];
  manual: ExportItem[];
  summary: {
    total: number;
    confirmedCount: number;
    pendingCount: number;
    manualCount: number;
    unresolvedAnomalies: number;
    totalDuration: number;
  };
}

export interface ImportResult {
  records: TimelineRecord[];
  anomalies: Anomaly[];
  stats: {
    total: number;
    normal: number;
    late: number;
    duplicates: number;
    missing: number;
  };
}

export type PanelTab = 'import' | 'anomalies' | 'history';
