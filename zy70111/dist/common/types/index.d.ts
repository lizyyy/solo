export declare enum CertificateStatus {
    ISSUED = "issued",
    BATCH_BOUND = "batch_bound",
    IN_TRANSPORT = "in_transport",
    TRANSPORT_VERIFIED = "transport_verified",
    MARKET_ACCEPTED = "market_accepted",
    VOIDED = "voided",
    MANUALLY_CORRECTED = "manually_corrected",
    DUPLICATE_DETECTED = "duplicate_detected"
}
export declare enum CertificateSource {
    FARM = "farm",
    SLAUGHTERHOUSE = "slaughterhouse",
    TRANSPORT = "transport",
    MARKET = "market"
}
export declare enum TransportStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    VERIFIED = "verified",
    REJECTED = "rejected"
}
export declare enum MarketInspectionResult {
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    NEEDS_REVIEW = "needs_review"
}
export declare enum VoidReason {
    DUPLICATE = "duplicate",
    ERROR = "error",
    CANCELLED = "cancelled",
    OTHER = "other"
}
export declare enum ReviewStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    RESOLVED = "resolved"
}
export declare enum ReviewPriority {
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export declare enum FlowAction {
    CERTIFICATE_ISSUED = "certificate_issued",
    BATCH_BOUND = "batch_bound",
    BATCH_UNBOUND = "batch_unbound",
    TRANSPORT_STARTED = "transport_started",
    TRANSPORT_VERIFIED = "transport_verified",
    TRANSPORT_REJECTED = "transport_rejected",
    MARKET_ACCEPTED = "market_accepted",
    MARKET_REJECTED = "market_rejected",
    CERTIFICATE_VOIDED = "certificate_voided",
    CERTIFICATE_REISSUED = "certificate_reissued",
    DUPLICATE_DETECTED = "duplicate_detected",
    MANUAL_CORRECTION = "manual_correction",
    REVIEW_CREATED = "review_created",
    REVIEW_RESOLVED = "review_resolved",
    EXPORT_REQUESTED = "export_requested",
    EXPORT_COMPLETED = "export_completed"
}
export declare enum EntityType {
    CERTIFICATE = "certificate",
    BATCH = "batch",
    TRANSPORT = "transport",
    MARKET_INSPECTION = "market_inspection",
    VOID_RECORD = "void_record",
    REVIEW_TASK = "review_task"
}
export declare enum ExportType {
    DAILY_REPORT = "daily_report",
    DUPLICATE_ANALYSIS = "duplicate_analysis",
    FLOW_HISTORY = "flow_history",
    REVIEW_SUMMARY = "review_summary",
    COMPLIANCE_CHECK = "compliance_check"
}
export declare enum ExportStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}
export interface ProcessingResult<T = any> {
    success: boolean;
    data?: T;
    needsReview: boolean;
    reviewReason?: string;
    reviewPriority?: ReviewPriority;
    message: string;
    warnings?: string[];
}
export interface UserContext {
    userId: string;
    userName: string;
    role: string;
    source: CertificateSource;
}
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
