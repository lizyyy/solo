export interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    brand?: string;
    description?: string;
    images?: string[];
    stock?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}
export interface IndexSnapshot {
    id: string;
    timestamp: string;
    name: string;
    description?: string;
    productCount: number;
    filePath: string;
    createdAt: string;
}
export interface SourceData {
    id: string;
    timestamp: string;
    name: string;
    description?: string;
    productCount: number;
    filePath: string;
    sourceType: 'database' | 'api' | 'file';
    createdAt: string;
}
export interface FieldDiff {
    productId: string;
    fieldName: string;
    indexValue: unknown;
    sourceValue: unknown;
    diffType: 'missing' | 'mismatch' | 'extra';
}
export interface CheckResult {
    id: string;
    timestamp: string;
    snapshotId: string;
    sourceId: string;
    totalProducts: number;
    missingFieldsCount: number;
    mismatchedFieldsCount: number;
    productDiffs: ProductDiff[];
    summary: CheckSummary;
    createdAt: string;
}
export interface ProductDiff {
    productId: string;
    productName: string;
    missingFields: string[];
    mismatchedFields: FieldDiff[];
    extraFields: string[];
    hasIssue: boolean;
}
export interface CheckSummary {
    totalChecked: number;
    withIssues: number;
    withoutIssues: number;
    missingFieldsTotal: number;
    mismatchedFieldsTotal: number;
    mostCommonMissingFields: {
        field: string;
        count: number;
    }[];
}
export interface ReplayTask {
    id: string;
    name: string;
    description?: string;
    checkResultId: string;
    productIds: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: string;
    endTime?: string;
    successCount: number;
    failedCount: number;
    errors: string[];
    createdAt: string;
}
export interface CacheRefreshRecord {
    id: string;
    timestamp: string;
    productIds: string[];
    status: 'success' | 'failed' | 'partial';
    refreshedCount: number;
    failedCount: number;
    errors: string[];
    createdAt: string;
}
export interface Report {
    id: string;
    timestamp: string;
    name: string;
    type: 'field_missing' | 'replay_summary' | 'cache_summary' | 'comprehensive';
    checkResultId?: string;
    replayTaskId?: string;
    cacheRecordId?: string;
    filePath: string;
    createdAt: string;
}
export interface HistoryEntry {
    id: string;
    timestamp: string;
    type: 'init' | 'import' | 'check' | 'replay' | 'cache' | 'report';
    action: string;
    status: 'success' | 'failed';
    details: string;
    createdAt: string;
}
export interface AppConfig {
    dataDir: string;
    snapshotsDir: string;
    sourcesDir: string;
    resultsDir: string;
    reportsDir: string;
    historyFile: string;
    configFile: string;
}
//# sourceMappingURL=index.d.ts.map