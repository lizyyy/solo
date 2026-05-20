export declare enum LicenseType {
    BUSINESS_LICENSE = "BUSINESS_LICENSE",
    FIRE_SAFETY = "FIRE_SAFETY",
    FOOD_SAFETY = "FOOD_SAFETY",
    OTHER = "OTHER"
}
export declare enum DiscrepancyType {
    LICENSE_EXPIRED = "LICENSE_EXPIRED",
    TIME_CONFLICT = "TIME_CONFLICT",
    DEPOSIT_DEDUCTION = "DEPOSIT_DEDUCTION",
    MISSING_DOCUMENT = "MISSING_DOCUMENT",
    FEE_MISMATCH = "FEE_MISMATCH",
    MANUAL_REVIEW = "MANUAL_REVIEW"
}
export declare enum DepositDeductionType {
    FACILITY_DAMAGE = "FACILITY_DAMAGE",
    CLEANING_FEE = "CLEANING_FEE",
    OVERTIME_PENALTY = "OVERTIME_PENALTY",
    VIOLATION_FINE = "VIOLATION_FINE",
    OTHER = "OTHER"
}
export declare enum DiscrepancyStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    DOCUMENTS_REQUESTED = "DOCUMENTS_REQUESTED"
}
export declare enum ReviewResult {
    APPROVE = "APPROVE",
    REJECT = "REJECT",
    REQUEST_DOCUMENTS = "REQUEST_DOCUMENTS",
    ADJUST_AND_APPROVE = "ADJUST_AND_APPROVE"
}
export interface BoothApplication {
    id: string;
    applicationNo: string;
    merchantName: string;
    contactPerson: string;
    contactPhone: string;
    boothType: string;
    boothLocation: string;
    startDate: string;
    endDate: string;
    boothFee: number;
    depositAmount: number;
    status: string;
    appliedAt: string;
    notes?: string;
}
export interface LicenseAttachment {
    id: string;
    applicationId: string;
    licenseType: LicenseType;
    licenseNo: string;
    issueDate: string;
    expiryDate: string;
    fileName: string;
    uploadTime: string;
    isVerified: boolean;
    notes?: string;
}
export interface VenueCalendar {
    id: string;
    date: string;
    boothLocation: string;
    isAvailable: boolean;
    bookedApplicationId?: string;
    bookedMerchantName?: string;
    notes?: string;
}
export interface Discrepancy {
    id: string;
    reconciliationId: string;
    type: DiscrepancyType;
    description: string;
    sourceField?: string;
    expectedValue?: string;
    actualValue?: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    status: DiscrepancyStatus;
    requiresManualReview: boolean;
    explanation?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ReviewAction {
    id: string;
    reconciliationId: string;
    discrepancyId?: string;
    reviewer: string;
    reviewResult: ReviewResult;
    reviewNotes: string;
    adjustmentAmount?: number;
    adjustmentReason?: string;
    reviewedAt: string;
}
export interface ReconciliationRecord {
    id: string;
    applicationId: string;
    applicationNo: string;
    merchantName: string;
    boothLocation: string;
    startDate: string;
    endDate: string;
    boothFee: number;
    depositAmount: number;
    actualBoothFee: number;
    actualDepositAmount: number;
    deductions: DeductionItem[];
    totalAmount: number;
    discrepancies: Discrepancy[];
    reviewActions: ReviewAction[];
    status: 'DRAFT' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
    createdAt: string;
    updatedAt: string;
    reviewedBy?: string;
    reviewedAt?: string;
    completedAt?: string;
}
export interface DeductionItem {
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
}
export interface ReconciliationSummary {
    totalRecords: number;
    approvedRecords: number;
    rejectedRecords: number;
    pendingRecords: number;
    totalBoothFee: number;
    totalDeposit: number;
    totalDeductions: number;
    netAmount: number;
    discrepancyCount: {
        licenseExpired: number;
        timeConflict: number;
        depositDeduction: number;
        missingDocument: number;
        feeMismatch: number;
        manualReview: number;
    };
}
export interface DepositDeductionRecord {
    id: string;
    applicationId: string;
    deductionType: DepositDeductionType;
    amount: number;
    description: string;
    reportedBy: string;
    reportedAt: string;
    isVerified: boolean;
    evidence?: string;
    notes?: string;
}
export interface ImportResult {
    success: boolean;
    importedCount: number;
    failedCount: number;
    errors: string[];
    warnings: string[];
}
