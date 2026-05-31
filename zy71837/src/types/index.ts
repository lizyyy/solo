export type RecordStatus = 'normal' | 'warning' | 'anomaly';

export type OperationType = 'import' | 'edit' | 'rollback' | 'batch' | 'delete' | 'correct';

export type AnomalyType = 'mismatch' | 'duplicate' | 'out_of_range' | 'missing_data';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyStatus = 'open' | 'resolved' | 'ignored';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface BattleRecord {
  id: string;
  battleId: string;
  playerId: string;
  playerName: string;
  score: number;
  settlement: number;
  status: RecordStatus;
  battleTime: string;
  dataFingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterConditions {
  battleId?: string;
  playerId?: string;
  playerName?: string;
  status?: RecordStatus[];
  battleTimeRange?: [string, string];
  scoreRange?: [number, number];
  settlementRange?: [number, number];
}

export interface VersionSnapshot {
  id: string;
  version: number;
  parentVersionId: string | null;
  operationType: OperationType;
  operator: string;
  remark: string;
  dataFingerprint: string;
  snapshotData: BattleRecord[];
  filterFingerprint: string;
  filterConditions: FilterConditions;
  createdAt: string;
}

export interface Anomaly {
  id: string;
  versionId: string;
  recordId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  fieldName?: string;
  expectedValue?: number | string;
  actualValue?: number | string;
  description: string;
  explanation: string;
  suggestion: string;
  status: AnomalyStatus;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface BatchTask {
  id: string;
  name: string;
  operationType: OperationType;
  config: Record<string, any>;
  idempotencyKey: string;
  maxRuns: number;
  isIdempotent: boolean;
  createdAt: string;
}

export interface BatchExecution {
  id: string;
  taskId: string;
  idempotencyKey: string;
  status: ExecutionStatus;
  progress: number;
  successCount: number;
  failCount: number;
  logs: string[];
  result: Record<string, any>;
  startTime: string;
  endTime?: string;
}

export interface ExportSnapshot {
  id: string;
  versionId: string;
  filterFingerprint: string;
  filterConditions: FilterConditions;
  format: ExportFormat;
  dataFingerprint: string;
  screenDataFingerprint: string;
  consistencyCheckPassed: boolean;
  consistencyCheckDetails: Record<string, any>;
  fileName: string;
  operator: string;
  remark: string;
  exportedAt: string;
}

export interface AuditLog {
  id: string;
  versionId: string;
  action: string;
  operator: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface DiffResult {
  added: BattleRecord[];
  removed: BattleRecord[];
  modified: {
    record: BattleRecord;
    oldRecord: BattleRecord;
    changedFields: string[];
  }[];
}

export interface ConsistencyCheckResult {
  passed: boolean;
  details: {
    recordCountMatch: boolean;
    screenCount: number;
    exportCount: number;
    filterFingerprintMatch: boolean;
    mismatchedRecords: string[];
  };
}
