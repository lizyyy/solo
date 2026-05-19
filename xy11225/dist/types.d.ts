export declare enum FaultType {
    CABINET_DOOR_FAILED = "\u67DC\u95E8\u6253\u4E0D\u5F00",
    SCAN_FAILED = "\u626B\u7801\u5931\u8D25",
    EMPTY_BIN_FALSE_ALARM = "\u7A7A\u4ED3\u8BEF\u62A5",
    OTHER = "\u5176\u4ED6"
}
export declare enum RecordStatus {
    PENDING = "\u5F85\u5904\u7406",
    PROCESSING = "\u5904\u7406\u4E2D",
    RESOLVED = "\u5DF2\u89E3\u51B3",
    REJECTED = "\u5DF2\u9A73\u56DE",
    MERGED = "\u5DF2\u5408\u5E76"
}
export declare enum ProcessingResult {
    ALLOWED = "\u653E\u884C",
    BLOCKED = "\u62E6\u622A"
}
export interface FaultRecord {
    id: string;
    cabinetId: string;
    faultType: FaultType;
    description: string;
    reporter: string;
    handler?: string;
    status: RecordStatus;
    isOffline: boolean;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    mergedFrom?: string[];
    processingResult?: ProcessingResult;
    processingReason?: string;
    batchId?: string;
}
export interface BatchOperationResult {
    batchId: string;
    total: number;
    successCount: number;
    failureCount: number;
    successes: string[];
    failures: Array<{
        recordId?: string;
        error: string;
    }>;
    createdAt: string;
}
export interface StorageData {
    records: FaultRecord[];
    batches: BatchOperationResult[];
    cabinets: {
        [cabinetId: string]: {
            isOffline: boolean;
            lastMaintenanceAt?: string;
        };
    };
}
export interface FilterOptions {
    handler?: string;
    startDate?: string;
    endDate?: string;
    status?: RecordStatus;
    faultType?: FaultType;
    cabinetId?: string;
}
export interface RuleValidationResult {
    passed: boolean;
    reason: string;
    action?: 'merge' | 'block' | 'allow' | 'flag';
    relatedRecordId?: string;
}
