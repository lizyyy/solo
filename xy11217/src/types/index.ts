export enum RecordStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  QUARANTINED = 'quarantined'
}

export enum RuleType {
  EXPIRED_SAMPLE = 'expired_sample',
  TEMPERATURE_GAP = 'temperature_gap',
  BATCH_SUMMARY = 'batch_summary'
}

export enum UserRole {
  STORE_MANAGER = 'store_manager',
  QUALITY_CONTROL = 'quality_control',
  ADMIN = 'admin'
}

export interface SampleRecord {
  id: string;
  storeId: string;
  storeName: string;
  dishId: string;
  dishName: string;
  batchNo: string;
  sampleTime: string;
  samplePerson: string;
  samplePersonPhone?: string;
  expireTime: string;
  storageLocation: string;
  status: RecordStatus;
  reviewStatus?: string;
  reviewTime?: string;
  reviewer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureRecord {
  id: string;
  storeId: string;
  storeName: string;
  fridgeId: string;
  fridgeName: string;
  recordTime: string;
  temperature: number;
  minTemp: number;
  maxTemp: number;
  recordPerson: string;
  recordPersonPhone?: string;
  status: RecordStatus;
  reviewStatus?: string;
  reviewTime?: string;
  reviewer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WasteRecord {
  id: string;
  storeId: string;
  storeName: string;
  dishId: string;
  dishName: string;
  batchNo: string;
  wasteTime: string;
  wasteAmount: number;
  wasteReason: string;
  wastePerson: string;
  wastePersonPhone?: string;
  status: RecordStatus;
  reviewStatus?: string;
  reviewTime?: string;
  reviewer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleLog {
  id: string;
  ruleType: RuleType;
  recordId: string;
  recordType: 'sample' | 'temperature' | 'waste';
  storeId: string;
  batchNo?: string;
  action: 'block' | 'pass' | 'quarantine' | 'alert';
  reason: string;
  details: string;
  processedAt: string;
  processedBy?: string;
}

export interface ImportHistory {
  id: string;
  fileName: string;
  fileType: 'sample' | 'temperature' | 'waste';
  totalRecords: number;
  successCount: number;
  failedCount: number;
  errors: string;
  importedBy: string;
  importedAt: string;
  status: 'processing' | 'completed' | 'failed';
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  operator: string;
  operatorRole: UserRole;
  operatedAt: string;
  ip?: string;
}

export interface QueryOptions {
  storeId?: string;
  startDate?: string;
  endDate?: string;
  status?: RecordStatus;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RuleExecutionResult {
  total: number;
  matched: number;
  blocked: number;
  passed: number;
}

export interface BatchSummary {
  batchNo: string;
  storeIds: string[];
  storeNames: string[];
  sampleCount: number;
  wasteCount: number;
  anomalyCount: number;
}
