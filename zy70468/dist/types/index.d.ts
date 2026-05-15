export declare enum RiskType {
    PATH_ERROR = "compression_path_error",
    DATA_INCONSISTENCY = "data_inconsistency",
    TIMEOUT = "processing_timeout",
    FORMAT_ERROR = "format_error",
    DUPLICATE_RECORD = "duplicate_record",
    MANUAL_REVIEW = "manual_review_required"
}
export declare enum ProcessingStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    SUCCESS = "success",
    FAILED = "failed",
    MANUAL_CORRECTED = "manual_corrected"
}
export declare enum ApprovalNode {
    UPLOAD = "upload",
    PRE_CHECK = "pre_check",
    DATA_EXTRACTION = "data_extraction",
    RISK_ASSESSMENT = "risk_assessment",
    FINAL_REVIEW = "final_review",
    COMPLETED = "completed"
}
export interface SmsRecord {
    id: string;
    phone: string;
    content: string;
    sendTime: string;
    status: 'pending' | 'sent' | 'failed';
}
export interface ChangeRecord {
    id: string;
    batchId: string;
    invoiceNumber: string;
    originalAmount: number;
    redFlushAmount: number;
    archivePath: string;
    operator: string;
    riskType: RiskType;
    status: ProcessingStatus;
    currentApprovalNode: ApprovalNode;
    failureReason?: string;
    materialSummary: string;
    smsRecords: SmsRecord[];
    createdAt: string;
    updatedAt: string;
}
export interface ManualCorrection {
    id: string;
    recordId: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    operator: string;
    remark: string;
    approvalNode: ApprovalNode;
    correctedAt: string;
}
export interface Batch {
    id: string;
    name: string;
    totalRecords: number;
    successCount: number;
    failedCount: number;
    operator: string;
    createdAt: string;
    completedAt?: string;
}
export interface QueryFilter {
    batchId?: string;
    operator?: string;
    riskType?: RiskType;
    status?: ProcessingStatus;
    startDate?: string;
    endDate?: string;
}
