export type SourceType = 'order' | 'waste' | 'price' | 'supplement';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'waiting_retry' | 'waiting_manual' | 'permanent_failed';

export type FailureCategory = 'retryable' | 'needs_manual' | 'permanent';

export type AnomalyType = 'quantity_mismatch' | 'price_mismatch' | 'missing_record' | 'duplicate_record' | 'data_corruption';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ImportSource {
  sourceId: string;
  fileName: string;
  fileHash: string;
  sourceType: SourceType;
  importedBy: string;
}

export interface OrderItemRaw {
  orderNo: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  franchiseeId: string;
  franchiseeName: string;
  orderDate: string;
}

export interface WasteRecordRaw {
  wasteNo: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  wasteReason: string;
  franchiseeId: string;
  franchiseeName: string;
  wasteDate: string;
}

export interface HeadquarterPriceRaw {
  materialCode: string;
  materialName: string;
  price: number;
  unit: string;
  effectiveDate: string;
  expireDate?: string;
}

export interface SupplementRecordRaw {
  supplementNo: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplementReason: string;
  franchiseeId: string;
  franchiseeName: string;
  supplementDate: string;
}

export interface VerificationTask {
  taskId: string;
  taskType: string;
  status: TaskStatus;
  payload: string;
  retryCount: number;
  maxRetries: number;
  failureCategory?: FailureCategory;
  failureReason?: string;
  manualOpinion?: string;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ImportResult {
  sourceId: string;
  totalRecords: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
}
