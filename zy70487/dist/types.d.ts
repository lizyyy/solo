export declare enum RiskType {
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW"
}
export declare enum ProcessingStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    BLOCKED = "BLOCKED",
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS",
    EARLY_TERMINATION_BLOCKED = "EARLY_TERMINATION_BLOCKED"
}
export declare enum Department {
    CUSTOMER_SERVICE = "CUSTOMER_SERVICE",
    RISK_CONTROL = "RISK_CONTROL",
    OPERATION = "OPERATION",
    FINANCE = "FINANCE",
    COMPLIANCE = "COMPLIANCE"
}
export interface TempTicket {
    id: string;
    ticketNo: string;
    applicant: string;
    department: Department;
    permissionType: string;
    reason: string;
    startTime: Date;
    endTime: Date;
    createdAt: Date;
    createdBy: string;
}
export interface MessageRecord {
    id: string;
    batchId: string;
    ticketId: string;
    phone: string;
    idCard: string;
    userName: string;
    content: string;
    riskType: RiskType;
    riskScore: number;
    riskReason: string;
    status: ProcessingStatus;
    blockReason?: string;
    operator: string;
    processedAt?: Date;
    createdAt: Date;
    reviewRecords: ReviewRecord[];
}
export interface ReviewRecord {
    id: string;
    messageId: string;
    reviewer: string;
    reviewOpinion: string;
    serviceTicketNo: string;
    originalConclusion: ProcessingStatus;
    newConclusion: ProcessingStatus;
    reviewedAt: Date;
}
export interface BatchInfo {
    id: string;
    batchNo: string;
    name: string;
    operator: string;
    totalCount: number;
    successCount: number;
    failedCount: number;
    blockedCount: number;
    status: ProcessingStatus;
    createdAt: Date;
    completedAt?: Date;
}
export interface BlockRule {
    id: string;
    name: string;
    description: string;
    condition: (record: MessageRecord, ticket: TempTicket) => boolean;
    blockReason: string;
}
export interface ProcessResult {
    batchId: string;
    total: number;
    success: number;
    failed: number;
    blocked: number;
    results: Array<{
        recordId: string;
        userName: string;
        phone: string;
        status: ProcessingStatus;
        reason?: string;
    }>;
}
