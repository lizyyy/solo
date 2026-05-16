export declare enum CancelRequestStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    INTERCEPTED = "INTERCEPTED",
    CANCELED = "CANCELED",
    COMPENSATED = "COMPENSATED"
}
export declare enum TaskExecutionStatus {
    PENDING = "PENDING",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELED = "CANCELED"
}
export declare enum RetainResultPolicy {
    ALL = "ALL",
    NONE = "NONE",
    PARTIAL = "PARTIAL"
}
export interface JobTask {
    taskId: string;
    taskName: string;
    executionStatus: TaskExecutionStatus;
    startedAt?: Date;
    completedAt?: Date;
    result?: unknown;
    error?: string;
}
export interface CancelReason {
    code: string;
    message: string;
    operator: string;
    operatedAt: Date;
    evidence?: string;
}
export interface FailurePath {
    originalInput: unknown;
    processingBasis: string;
    conclusion: string;
    occurredAt: Date;
}
export interface CancelReport {
    reportId: string;
    generatedAt: Date;
    totalTasks: number;
    interceptedTasks: number;
    canceledTasks: number;
    protectedTasks: number;
    failedTasks: number;
    summary: string;
    details: {
        taskId: string;
        taskName: string;
        originalStatus: TaskExecutionStatus;
        finalStatus: TaskExecutionStatus;
        action: string;
        reason: string;
    }[];
    failurePaths: FailurePath[];
}
export interface CancelRequest {
    requestId: string;
    jobId: string;
    jobName: string;
    status: CancelRequestStatus;
    tasks: JobTask[];
    reasons: CancelReason[];
    retainResultPolicy: RetainResultPolicy;
    reports: CancelReport[];
    failurePaths: FailurePath[];
    createdAt: Date;
    updatedAt: Date;
    confirmedAt?: Date;
    completedAt?: Date;
}
export interface CreateCancelRequestRequest {
    jobId: string;
    jobName: string;
    tasks: Array<{
        taskId: string;
        taskName: string;
        executionStatus: TaskExecutionStatus;
    }>;
    reason: {
        code: string;
        message: string;
        operator: string;
        evidence?: string;
    };
    retainResultPolicy: RetainResultPolicy;
}
export interface UpdateStatusRequest {
    status: CancelRequestStatus;
    operator: string;
    reason?: string;
}
export interface ManualCorrectionRequest {
    taskId: string;
    newStatus: TaskExecutionStatus;
    operator: string;
    reason: string;
}
export interface QueryParams {
    jobId?: string;
    status?: CancelRequestStatus;
    operator?: string;
    startTime?: Date;
    endTime?: Date;
    page?: number;
    pageSize?: number;
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
