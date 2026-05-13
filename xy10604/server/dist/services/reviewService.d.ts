import { ReviewRecord, ReviewDecision } from '@prisma/client';
interface CreateReviewParams {
    batchId: string;
    experimentId?: string;
    openRecordId?: string;
    blockRecordId?: string;
    reviewerId: string;
    decision: ReviewDecision;
    reason: string;
    notes?: string;
}
export declare const createReview: (params: CreateReviewParams) => Promise<ReviewRecord>;
export declare const getReviewRecords: (params: {
    page?: number;
    limit?: number;
    batchId?: string;
    experimentId?: string;
    reviewerId?: string;
    decision?: ReviewDecision;
    startDate?: string;
    endDate?: string;
}) => Promise<{
    records: ({
        experiment: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            status: import(".prisma/client").$Enums.ExperimentStatus;
            createdById: string;
            batchId: string;
            scheduledDate: Date;
            openRecordId: string | null;
            actualStartDate: Date | null;
            actualEndDate: Date | null;
        } | null;
        blockRecord: {
            id: string;
            batchId: string;
            blockedAt: Date;
            openRecordId: string | null;
            isResolved: boolean;
            experimentId: string | null;
            reason: import(".prisma/client").$Enums.BlockReason;
            details: string | null;
            resolvedAt: Date | null;
            resolvedBy: string | null;
            resolutionNotes: string | null;
        } | null;
        batch: {
            reagent: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                code: string;
                description: string | null;
                defaultExpiryDays: number;
                nearExpiryDays: number;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            reagentId: string;
            batchNumber: string;
            productionDate: Date;
            expiryDate: Date;
            originalQty: number;
            currentQty: number;
            unit: string;
            status: import(".prisma/client").$Enums.ReagentStatus;
            createdById: string;
        };
        reviewer: {
            id: string;
            username: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        id: string;
        batchId: string;
        notes: string | null;
        reviewedAt: Date;
        openRecordId: string | null;
        experimentId: string | null;
        reason: string;
        blockRecordId: string | null;
        reviewerId: string;
        decision: import(".prisma/client").$Enums.ReviewDecision;
        affectedRecords: import("@prisma/client/runtime/library").JsonValue | null;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare const getReviewById: (id: string) => Promise<({
    experiment: ({
        createdBy: {
            id: string;
            username: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        status: import(".prisma/client").$Enums.ExperimentStatus;
        createdById: string;
        batchId: string;
        scheduledDate: Date;
        openRecordId: string | null;
        actualStartDate: Date | null;
        actualEndDate: Date | null;
    }) | null;
    blockRecord: {
        id: string;
        batchId: string;
        blockedAt: Date;
        openRecordId: string | null;
        isResolved: boolean;
        experimentId: string | null;
        reason: import(".prisma/client").$Enums.BlockReason;
        details: string | null;
        resolvedAt: Date | null;
        resolvedBy: string | null;
        resolutionNotes: string | null;
    } | null;
    batch: {
        reagent: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            code: string;
            description: string | null;
            defaultExpiryDays: number;
            nearExpiryDays: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reagentId: string;
        batchNumber: string;
        productionDate: Date;
        expiryDate: Date;
        originalQty: number;
        currentQty: number;
        unit: string;
        status: import(".prisma/client").$Enums.ReagentStatus;
        createdById: string;
    };
    reviewer: {
        id: string;
        username: string;
        name: string;
        role: import(".prisma/client").$Enums.UserRole;
    };
} & {
    id: string;
    batchId: string;
    notes: string | null;
    reviewedAt: Date;
    openRecordId: string | null;
    experimentId: string | null;
    reason: string;
    blockRecordId: string | null;
    reviewerId: string;
    decision: import(".prisma/client").$Enums.ReviewDecision;
    affectedRecords: import("@prisma/client/runtime/library").JsonValue | null;
}) | null>;
export {};
