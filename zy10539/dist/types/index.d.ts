export declare enum CorrectionStatus {
    DRAFT = "DRAFT",
    PREVIEWED = "PREVIEWED",
    PENDING_APPROVAL = "PENDING_APPROVAL",
    APPROVED = "APPROVED",
    EXECUTING = "EXECUTING",
    COMPLETED = "COMPLETED",
    REJECTED = "REJECTED",
    ROLLED_BACK = "ROLLED_BACK",
    EXCEPTION = "EXCEPTION"
}
export declare enum ExceptionType {
    ASSET_NOT_FOUND = "ASSET_NOT_FOUND",
    TAG_CONFLICT = "TAG_CONFLICT",
    COST_CALCULATION_ERROR = "COST_CALCULATION_ERROR",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    EXECUTION_FAILED = "EXECUTION_FAILED",
    ROLLBACK_FAILED = "ROLLBACK_FAILED"
}
export interface AssetTag {
    assetId: string;
    assetName?: string;
    currentTags: Record<string, string>;
    targetTags: Record<string, string>;
    costProject?: string;
    originalCostProject?: string;
}
export interface CostImpact {
    assetId: string;
    previousCost: number;
    estimatedNewCost: number;
    costChange: number;
    affectedPeriods: string[];
    costProjectChange?: {
        from: string;
        to: string;
    };
}
export interface TagDiff {
    assetId: string;
    addedTags: Record<string, string>;
    removedTags: Record<string, string>;
    modifiedTags: Record<string, {
        from: string;
        to: string;
    }>;
    unchangedTags: Record<string, string>;
}
export interface RollbackPoint {
    id: string;
    correctionId: string;
    timestamp: Date;
    snapshot: {
        assetId: string;
        tags: Record<string, string>;
        costProject: string;
    }[];
    createdBy: string;
}
export interface ExceptionRecord {
    id: string;
    correctionId: string;
    type: ExceptionType;
    message: string;
    timestamp: Date;
    originalInput: unknown;
    processingEvidence: string[];
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
    resolution?: string;
}
export interface CorrectionRequest {
    id: string;
    title: string;
    description?: string;
    applicant: string;
    applicantDepartment: string;
    status: CorrectionStatus;
    assets: AssetTag[];
    tagDiffs?: TagDiff[];
    costImpacts?: CostImpact[];
    approver?: string;
    approvalComment?: string;
    approvedAt?: Date;
    rollbackPoints: RollbackPoint[];
    exceptions: ExceptionRecord[];
    createdAt: Date;
    updatedAt: Date;
    executedAt?: Date;
    completedAt?: Date;
}
export interface CorrectionReport {
    id: string;
    correctionId: string;
    generatedAt: Date;
    generatedBy: string;
    summary: {
        totalAssets: number;
        successfulCorrections: number;
        failedCorrections: number;
        totalCostChange: number;
    };
    details: Array<{
        assetId: string;
        assetName?: string;
        previousTags: Record<string, string>;
        newTags: Record<string, string>;
        previousCostProject: string;
        newCostProject: string;
        costImpact: number;
        status: string;
        remarks?: string;
    }>;
    exceptions: ExceptionRecord[];
    auditTrail: Array<{
        timestamp: Date;
        action: string;
        operator: string;
        comment?: string;
    }>;
}
export interface CreateCorrectionRequest {
    title: string;
    description?: string;
    applicant: string;
    applicantDepartment: string;
    assets: Array<{
        assetId: string;
        targetTags: Record<string, string>;
        costProject?: string;
    }>;
}
export interface QueryCorrectionParams {
    status?: CorrectionStatus;
    applicant?: string;
    department?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
