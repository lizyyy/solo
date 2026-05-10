export type RuleVersionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
export type BatchStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type AlertSubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';
export type OperationType = 'CREATE' | 'UPDATE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH' | 'ARCHIVE' | 'BATCH_START' | 'BATCH_SUCCESS' | 'BATCH_FAILED' | 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'WAIVE' | 'REPORT_GENERATE';
export interface RuleVersion {
    id: string;
    ruleId: string;
    ruleName: string;
    version: number;
    status: RuleVersionStatus;
    content: string;
    description?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    approvedBy?: string;
    approvedAt?: string;
    publishedAt?: string;
}
export interface BatchRecalculation {
    id: string;
    ruleVersionId: string;
    batchDate: string;
    status: BatchStatus;
    dataCount: number;
    passCount: number;
    failCount: number;
    errorMessage?: string;
    startedAt: string;
    completedAt?: string;
    createdBy: string;
}
export interface AlertSubscription {
    id: string;
    ruleVersionId: string;
    subscriberId: string;
    subscriberName: string;
    email: string;
    status: AlertSubscriptionStatus;
    createdAt: string;
    lastNotifiedAt?: string;
    errorMessage?: string;
}
export interface FalsePositiveWaive {
    id: string;
    ruleVersionId: string;
    batchId: string;
    reason: string;
    waivedBy: string;
    waivedAt: string;
    affectedRows: number;
}
export interface QualityReport {
    id: string;
    ruleVersionId: string;
    reportDate: string;
    totalBatches: number;
    successBatches: number;
    failBatches: number;
    averageScore: number;
    generatedAt: string;
}
export interface OperationLog {
    id: string;
    operationType: OperationType;
    entityType: string;
    entityId: string;
    fromStatus?: string;
    toStatus?: string;
    description: string;
    operator: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
export interface StateTransitionError {
    code: string;
    message: string;
    fromStatus?: string;
    toStatus?: string;
    allowedTransitions?: string[];
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    pagination?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=index.d.ts.map