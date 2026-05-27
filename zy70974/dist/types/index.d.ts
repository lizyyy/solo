export declare enum ActivityType {
    PARENT_CHILD = "parent_child",
    ELDERLY = "elderly"
}
export declare enum RegistrationStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    CANCELLED = "cancelled",
    WAITLIST = "waitlist",
    PROMOTED = "promoted"
}
export declare enum CheckInStatus {
    NOT_CHECKED_IN = "not_checked_in",
    CHECKED_IN = "checked_in",
    ABSENT = "absent"
}
export declare enum ReviewStatus {
    PENDING_REVIEW = "pending_review",
    APPROVED = "approved",
    REJECTED = "rejected",
    NEEDS_MORE_INFO = "needs_more_info"
}
export declare enum DiscrepancyType {
    DUPLICATE_REGISTRATION = "duplicate_registration",
    BLACKLISTED = "blacklisted",
    WAITLIST_PROMOTED = "waitlist_promoted",
    CANCELLED_BUT_CHECKED_IN = "cancelled_but_checked_in",
    NOT_REGISTERED_BUT_CHECKED_IN = "not_registered_but_checked_in",
    REGISTERED_BUT_NOT_CHECKED_IN = "registered_but_not_checked_in",
    INFO_MISMATCH = "info_mismatch",
    MANUAL_CHANGE = "manual_change"
}
export declare enum DataSource {
    REGISTRATION_CSV = "registration_csv",
    WAITLIST_JSON = "waitlist_json",
    CHECKIN_CSV = "checkin_csv",
    BLACKLIST_JSON = "blacklist_json",
    MANUAL = "manual"
}
export interface RegistrationRecord {
    id: string;
    activityType: ActivityType;
    activityName: string;
    name: string;
    phone: string;
    idCard?: string;
    registrationTime: Date;
    status: RegistrationStatus;
    source: DataSource;
    originalData: Record<string, any>;
}
export interface WaitlistRecord {
    id: string;
    activityType: ActivityType;
    activityName: string;
    name: string;
    phone: string;
    idCard?: string;
    waitlistPosition: number;
    addedTime: Date;
    promotedToMain?: boolean;
    promotedTime?: Date;
    source: DataSource;
    originalData: Record<string, any>;
}
export interface CheckInRecord {
    id: string;
    activityType: ActivityType;
    activityName: string;
    name: string;
    phone: string;
    checkInTime: Date;
    status: CheckInStatus;
    source: DataSource;
    originalData: Record<string, any>;
}
export interface BlacklistRecord {
    id: string;
    name: string;
    phone: string;
    idCard?: string;
    reason: string;
    addedTime: Date;
    source: DataSource;
}
export interface Discrepancy {
    id: string;
    type: DiscrepancyType;
    description: string;
    severity: 'high' | 'medium' | 'low';
    relatedRecordIds: string[];
    sourceEvidence: {
        source: DataSource;
        field: string;
        expectedValue?: string;
        actualValue?: string;
    }[];
}
export interface AuditLogEntry {
    id: string;
    reconciliationId: string;
    recordId?: string;
    action: string;
    previousValue?: any;
    newValue?: any;
    operator: string;
    timestamp: Date;
    reason?: string;
}
export interface ReconciliationRecord {
    id: string;
    reconciliationBatchId: string;
    activityType: ActivityType;
    activityName: string;
    name: string;
    phone: string;
    idCard?: string;
    registrationId?: string;
    waitlistId?: string;
    checkInId?: string;
    registrationStatus?: RegistrationStatus;
    checkInStatus: CheckInStatus;
    checkInTime?: Date;
    checkInRowNumber?: number;
    checkInOriginalData?: Record<string, any>;
    reviewStatus: ReviewStatus;
    discrepancies: Discrepancy[];
    finalStatus: 'allowed' | 'rejected' | 'pending';
    finalReason?: string;
    auditTrail: AuditLogEntry[];
    createdAt: Date;
    updatedAt: Date;
}
export interface ReconciliationBatch {
    id: string;
    name: string;
    activityType: ActivityType;
    activityName: string;
    createdAt: Date;
    createdBy: string;
    status: 'importing' | 'processing' | 'ready_for_review' | 'reviewing' | 'completed';
    statistics: {
        totalRegistrations: number;
        totalWaitlist: number;
        totalCheckIns: number;
        matchedRecords: number;
        discrepancies: number;
        pendingReview: number;
        approved: number;
        rejected: number;
    };
    recordIds: string[];
}
export interface ImportResult<T> {
    success: boolean;
    data: T[];
    errors: string[];
    warnings: string[];
    totalCount: number;
    validCount: number;
}
export interface ReviewAction {
    recordId: string;
    action: 'approve' | 'reject' | 'request_info';
    reason: string;
    operator: string;
    updateFields?: Partial<ReconciliationRecord>;
}
