export declare enum InvitationBatchStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    ENROLLMENT_STARTED = "enrollment_started",
    ENROLLMENT_CLOSED = "enrollment_closed",
    EXECUTION_STARTED = "execution_started",
    EXECUTION_COMPLETED = "execution_completed",
    SETTLEMENT_STARTED = "settlement_started",
    SETTLEMENT_COMPLETED = "settlement_completed",
    CANCELLED = "cancelled"
}
export declare enum EnrollmentStatus {
    PENDING_REVIEW = "pending_review",
    APPROVED = "approved",
    REJECTED = "rejected",
    CANCELLED = "cancelled"
}
export declare enum ExecutionStatus {
    NOT_STARTED = "not_started",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare enum SettlementStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed"
}
export interface InvitationBatch {
    id: string;
    name: string;
    description: string;
    targetPeakLoad: number;
    unitPrice: number;
    enrollmentStartTime: Date;
    enrollmentEndTime: Date;
    executionStartTime: Date;
    executionEndTime: Date;
    status: InvitationBatchStatus;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface Enrollment {
    id: string;
    batchId: string;
    enterpriseId: string;
    enterpriseName: string;
    declaredCapacity: number;
    minimumGuaranteedCapacity?: number;
    contactName: string;
    contactPhone: string;
    status: EnrollmentStatus;
    reviewComment?: string;
    submittedAt: Date;
    reviewedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface ExecutionRecord {
    id: string;
    batchId: string;
    enrollmentId: string;
    enterpriseId: string;
    timestamp: Date;
    baselineLoad: number;
    actualLoad: number;
    sourceSystem: string;
    createdAt: Date;
    version: number;
}
export interface DeviationResult {
    enrollmentId: string;
    averageBaseline: number;
    averageActual: number;
    achievedReduction: number;
    expectedReduction: number;
    deviationRate: number;
    passThreshold: number;
    isPassed: boolean;
    calculatedAt: Date;
}
export interface SettlementResult {
    id: string;
    batchId: string;
    enrollmentId: string;
    enterpriseId: string;
    settlementAmount: number;
    deviationRate: number;
    reductionAmount: number;
    status: SettlementStatus;
    settlementTime?: Date;
    failureReason?: string;
    retryCount: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface EventRecord {
    id: string;
    batchId?: string;
    enrollmentId?: string;
    entityType: 'batch' | 'enrollment' | 'execution' | 'settlement';
    eventType: string;
    fromStatus?: string;
    toStatus?: string;
    payload: Record<string, unknown>;
    timestamp: Date;
    operator?: string;
    notes?: string;
}
export interface StateTransition {
    entityType: 'batch' | 'enrollment';
    fromStatus: string;
    toStatus: string;
    allowedOperations: string[];
    conditions?: ((context: Record<string, unknown>) => boolean)[];
}
export interface OperationResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    events?: EventRecord[];
}
export interface BackgroundTask {
    id: string;
    type: 'deviation_calculation' | 'settlement';
    batchId: string;
    enrollmentId?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    priority: number;
    payload: Record<string, unknown>;
    attemptCount: number;
    maxAttempts: number;
    lastError?: string;
    runAt?: Date;
    completedAt?: Date;
    createdAt: Date;
}
