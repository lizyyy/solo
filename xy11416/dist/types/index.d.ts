export type SourceType = 'resident_report' | 'technician_receipt' | 'material_usage' | 'supervisor_note';
export type RecordStatus = 'pending' | 'imported' | 'validated' | 'failed' | 'fixed' | 'withdrawn' | 'frozen';
export type ImportMode = 'create' | 'update' | 'skip' | 'withdraw';
export interface RawRecord {
    id: string;
    sourceFile: string;
    sourceType: SourceType;
    rawLineNumber: number;
    rawContent: string;
    importedAt: string;
    importBatchId: string;
    status: RecordStatus;
    isDeleted: boolean;
}
export interface StandardizedRecord {
    id: string;
    rawRecordId: string;
    factId: string;
    orderNumber?: string;
    residentName?: string;
    roomNumber?: string;
    phoneNumber?: string;
    repairType?: string;
    description?: string;
    reportTime?: string;
    technicianName?: string;
    arrivalTime?: string;
    completionTime?: string;
    repairResult?: string;
    materialName?: string;
    materialQuantity?: number;
    materialUnit?: string;
    supervisorNote?: string;
    standardizedAt: string;
    standardizedBy: string;
    isManualOverride: boolean;
    confidence: number;
}
export interface FactRecord {
    id: string;
    orderNumber: string;
    currentStatus: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    isFrozen: boolean;
    frozenAt?: string;
    frozenBy?: string;
}
export interface ValidationError {
    id: string;
    recordId: string;
    fieldName: string;
    errorCode: string;
    errorMessage: string;
    severity: 'error' | 'warning';
    createdAt: string;
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
    resolution?: string;
}
export interface ImportResult {
    batchId: string;
    totalRecords: number;
    successCount: number;
    failedCount: number;
    updatedCount: number;
    skippedCount: number;
    failedRecords: FailedRecord[];
    importedAt: string;
}
export interface FailedRecord {
    rawRecordId: string;
    sourceFile: string;
    rawLineNumber: number;
    rawContent: string;
    errors: string[];
}
export interface ImportSession {
    batchId: string;
    sourceType: SourceType;
    sourceFile: string;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'failed';
    totalRecords: number;
    processedRecords: number;
}
