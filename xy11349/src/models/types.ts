export interface LabValue {
  L: number;
  a: number;
  b: number;
}

export interface QualityRecord {
  id: string;
  batchId: string;
  orderId: string;
  labValues: LabValue;
  paperBatch: string;
  operator: string;
  role: string;
  measuredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

export interface ReworkRecord {
  id: string;
  qualityRecordId: string;
  batchId: string;
  reason: string;
  solution: string;
  operator: string;
  role: string;
  reworkedAt: Date;
  createdAt: Date;
}

export interface ImportHistory {
  id: string;
  importType: 'csv' | 'json' | 'text';
  fileName: string;
  operator: string;
  role: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  operator: string;
  role: string;
  timestamp: Date;
  details: Record<string, unknown>;
}

export interface BadRecord {
  id: string;
  importHistoryId: string;
  originalPosition: string;
  rawData: string;
  failureReason: string;
  suggestions: string[];
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ImportResult<T> {
  importHistoryId: string;
  successItems: Array<{ index: number; data: T }>;
  failedItems: Array<{ index: number; badRecord: BadRecord }>;
}

export interface UserContext {
  operator: string;
  role: string;
}

export type DataSource = 'color' | 'order' | 'rework';
