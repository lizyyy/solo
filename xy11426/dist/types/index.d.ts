export declare enum DataSourceType {
    VISITOR_APPOINTMENT = "visitor_appointment",
    GATE_RECORD = "gate_record",
    TEMP_PLATE = "temp_plate",
    REFUND_FLOW = "refund_flow"
}
export declare enum ImportStrategy {
    IGNORE = "ignore",
    OVERWRITE = "overwrite",
    APPEND = "append"
}
export declare enum TaskStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    RETRY = "retry",
    MANUAL = "manual",
    PERMANENT_FAILED = "permanent_failed",
    COMPLETED = "completed"
}
export declare enum RecordStatus {
    RAW = "raw",
    VALID = "valid",
    INVALID = "invalid",
    FIXED = "fixed"
}
export interface ImportBatch {
    id: string;
    sourceType: DataSourceType;
    fileName: string;
    fileHash: string;
    strategy: ImportStrategy;
    operator: string;
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export interface VisitorRecord {
    id: string;
    batchId: string;
    sourceType: DataSourceType;
    originalLineNo: number;
    visitorName: string;
    visitorPhone: string;
    idCard: string;
    plateNumber?: string;
    visitDate: string;
    startTime: string;
    endTime: string;
    gatePassed?: boolean;
    passTime?: string;
    gateNo?: string;
    status: RecordStatus;
    checkResult?: string;
    rawData: string;
    createdAt: string;
    updatedAt: string;
}
export interface CheckResult {
    id: string;
    batchId: string;
    recordId: string;
    checkType: string;
    passed: boolean;
    message: string;
    createdAt: string;
}
export interface AsyncTask {
    id: string;
    batchId: string;
    taskType: string;
    status: TaskStatus;
    retryCount: number;
    maxRetries: number;
    errorMessage?: string;
    errorStack?: string;
    processedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface AuditLog {
    id: string;
    batchId?: string;
    recordId?: string;
    operator: string;
    action: string;
    oldValue?: string;
    newValue?: string;
    ip?: string;
    createdAt: string;
}
export interface ImportOptions {
    sourceType: DataSourceType;
    strategy: ImportStrategy;
    operator: string;
    skipHeader?: boolean;
}
export interface ReportData {
    batchId: string;
    fileName: string;
    sourceType: DataSourceType;
    importTime: string;
    operator: string;
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    fixedRecords: number;
    failures: Array<{
        originalLineNo: number;
        visitorName: string;
        reason: string;
        suggestion: string;
    }>;
    fixedList: Array<{
        originalLineNo: number;
        visitorName: string;
        oldValue: string;
        newValue: string;
        fixReason: string;
    }>;
}
