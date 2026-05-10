export interface Sample {
    id: string;
    sampleNo: string;
    name: string;
    supplier: string;
    category: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    status: SampleStatus;
    version: number;
    isFrozen: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    frozenAt?: string;
}
export type SampleStatus = 'CREATED' | 'SHIPPED' | 'IN_TRIAL' | 'PENDING_REVIEW' | 'REVIEWED' | 'FINALIZED' | 'RETURNED';
export interface ReviewTask {
    id: string;
    sampleId: string;
    sampleNo: string;
    assignee: string;
    taskType: ReviewTaskType;
    status: TaskStatus;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    dueDate?: string;
    opinion?: string;
    rating?: number;
    completedAt?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export type ReviewTaskType = 'INITIAL_REVIEW' | 'TRIAL_REVIEW' | 'FINAL_REVIEW' | 'TECHNICAL_REVIEW' | 'QUALITY_REVIEW';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export interface TrialFeedback {
    id: string;
    sampleId: string;
    sampleNo: string;
    trialUser: string;
    trialDate: string;
    trialPeriod: number;
    trialLocation: string;
    testItems: TestItem[];
    overallRating: number;
    conclusion: string;
    suggestions?: string;
    attachments?: string[];
    createdBy: string;
    createdAt: string;
}
export interface TestItem {
    name: string;
    criteria: string;
    result: 'PASS' | 'FAIL' | 'PARTIAL';
    remarks?: string;
}
export interface FinalizationRecord {
    id: string;
    sampleId: string;
    sampleNo: string;
    finalVersion: number;
    approvedBy: string;
    approvedAt: string;
    finalQuantity: number;
    finalUnitPrice: number;
    finalTotalAmount: number;
    remarks?: string;
    attachments?: string[];
}
export interface ReturnRecord {
    id: string;
    sampleId: string;
    sampleNo: string;
    returnType: ReturnType;
    returnReason: string;
    returnQuantity: number;
    returnedBy: string;
    returnedAt: string;
    trackingNo?: string;
    receivedBy?: string;
    receivedAt?: string;
    remarks?: string;
}
export type ReturnType = 'UNQUALIFIED' | 'EXCESS' | 'CANCELED' | 'OTHER';
export interface HistoryRecord {
    id: string;
    entityType: EntityType;
    entityId: string;
    action: string;
    description: string;
    beforeState?: Record<string, any>;
    afterState?: Record<string, any>;
    operator: string;
    operationTime: string;
    ipAddress?: string;
}
export type EntityType = 'SAMPLE' | 'REVIEW_TASK' | 'TRIAL_FEEDBACK' | 'FINALIZATION' | 'RETURN';
export interface BackgroundTask {
    id: string;
    taskType: BackgroundTaskType;
    status: BackgroundTaskStatus;
    payload: Record<string, any>;
    result?: Record<string, any>;
    errorMessage?: string;
    errorStack?: string;
    retryCount: number;
    maxRetries: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    nextRetryAt?: string;
}
export type BackgroundTaskType = 'GENERATE_REPORT' | 'SEND_NOTIFICATION' | 'EXPORT_DATA' | 'BATCH_UPDATE' | 'SYNC_DATA';
export type BackgroundTaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message: string;
    errorCode?: string;
    timestamp: string;
}
export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
