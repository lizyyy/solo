export declare enum DataSourceType {
    ORDER = "order",
    LOSS = "loss",
    PRICE = "price",
    PHOTO = "photo"
}
export declare enum RecordStatus {
    PENDING = "pending",
    IMPORTED = "imported",
    CHECKING = "checking",
    VALID = "valid",
    INVALID = "invalid",
    FIXING = "fixing",
    FIXED = "fixed",
    REIMPORTED = "reimported",
    EXPORTED = "exported",
    ARCHIVED = "archived"
}
export declare enum CheckStatus {
    PASS = "pass",
    WARNING = "warning",
    FAIL = "fail",
    SKIPPED = "skipped"
}
export declare enum PermissionLevel {
    VIEWER = "viewer",
    OPERATOR = "operator",
    MANAGER = "manager",
    ADMIN = "admin"
}
export interface Operator {
    id: string;
    name: string;
    permission: PermissionLevel;
    department?: string;
}
export interface StateChange {
    id: string;
    recordId: string;
    fromStatus: RecordStatus | null;
    toStatus: RecordStatus;
    operator: Operator;
    reason: string;
    timestamp: number;
    metadata?: Record<string, any>;
}
export interface CheckResult {
    id: string;
    recordId: string;
    checkName: string;
    status: CheckStatus;
    message: string;
    details?: Record<string, any>;
    timestamp: number;
    operatorId: string;
}
export interface RawData {
    sourceType: DataSourceType;
    sourceFile: string;
    originalRowNumber: number;
    rawContent: Record<string, any>;
    fileHash: string;
    importBatchId: string;
}
export interface TeaMaterialRecord {
    id: string;
    rawData: RawData;
    status: RecordStatus;
    stateChanges: StateChange[];
    checkResults: CheckResult[];
    materialCode?: string;
    materialName?: string;
    quantity?: number;
    unit?: string;
    price?: number;
    totalAmount?: number;
    supplier?: string;
    batchNumber?: string;
    productionDate?: string;
    expiryDate?: string;
    storeId?: string;
    storeName?: string;
    photoPath?: string;
    photoHash?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    notes?: string;
    tags: string[];
}
export interface ImportBatch {
    id: string;
    sourceType: DataSourceType;
    sourceFile: string;
    fileHash: string;
    operatorId: string;
    timestamp: number;
    totalRecords: number;
    successCount: number;
    failedCount: number;
    status: 'processing' | 'completed' | 'failed';
    errorMessage?: string;
}
export interface ReportSummary {
    batchId?: string;
    generatedAt: number;
    generatedBy: string;
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    pendingRecords: number;
    fixedRecords: number;
    totalAmount: number;
    bySource: Record<DataSourceType, number>;
    byStatus: Record<RecordStatus, number>;
    failureReasons: Record<string, number>;
}
export interface FailureRecord {
    recordId: string;
    originalRowNumber: number;
    sourceType: DataSourceType;
    sourceFile: string;
    status: RecordStatus;
    failureReasons: string[];
    firstFailedAt: number;
    lastFailedAt: number;
    fixAttempts: number;
    rawContent: Record<string, any>;
}
export interface DatabaseConfig {
    path: string;
    workDir: string;
    importDir: string;
    exportDir: string;
    photoDir: string;
}
export interface AuditLog {
    id: string;
    action: string;
    operatorId: string;
    operatorName: string;
    timestamp: number;
    resourceType: string;
    resourceId?: string;
    details: Record<string, any>;
    ipAddress?: string;
}
