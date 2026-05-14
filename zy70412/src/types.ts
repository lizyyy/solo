export interface SchemaDiff {
  path: string;
  type: 'added' | 'removed' | 'modified' | 'type-changed';
  oldValue?: any;
  newValue?: any;
}

export interface CompensationAction {
  id: string;
  name: string;
  description: string;
  required: boolean;
  executed: boolean;
  executedAt?: string;
}

export interface LogisticsInterception {
  id: string;
  orderId: string;
  waybillNo: string;
  status: 'pending' | 'intercepted' | 'released' | 'failed';
  interceptionTime?: string;
  releaseTime?: string;
  reason: string;
  grayRelease: boolean;
  compensationActions: CompensationAction[];
  failedPath?: string;
}

export interface BatchResult {
  batchId: string;
  submittedAt: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  items: BatchItem[];
  previewMode: boolean;
}

export interface BatchItem {
  id: string;
  orderId: string;
  status: 'success' | 'failed' | 'skipped' | 'preview';
  previousResultId?: string;
  conflict?: boolean;
  conflictReason?: string;
  humanRemarks?: string;
  failureReason?: string;
  failureGroup?: string;
  schemaDiffs?: SchemaDiff[];
  lakehousePartition?: string;
  humanConfirmed?: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface StoredResult {
  id: string;
  batchId: string;
  itemId: string;
  orderId: string;
  waybillNo: string;
  status: string;
  schemaDiffs: SchemaDiff[];
  failureReason?: string;
  failureGroup?: string;
  lakehousePartition?: string;
  humanRemarks?: string;
  humanConfirmed?: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LakehousePartition {
  name: string;
  date: string;
  region: string;
  recordCount: number;
  humanConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}
