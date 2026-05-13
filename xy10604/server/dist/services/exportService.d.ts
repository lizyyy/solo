import * as ExcelJS from 'exceljs';
interface ExportParams {
    format: 'excel' | 'pdf';
    startDate?: string;
    endDate?: string;
    reviewerId?: string;
    includeAuditLogs?: boolean;
    includeReviews?: boolean;
    includeDiscards?: boolean;
}
export declare const generateExport: (params: ExportParams) => Promise<ExcelJS.Buffer>;
export declare const getReviewDetailsForExport: (reviewId: string) => Promise<{
    review: {
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
            createdBy: {
                id: string;
                username: string;
                name: string;
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
    };
    relatedAuditLogs: ({
        user: {
            id: string;
            username: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        oldValues: import("@prisma/client/runtime/library").JsonValue | null;
        newValues: import("@prisma/client/runtime/library").JsonValue | null;
        userId: string;
        timestamp: Date;
        ipAddress: string | null;
        userAgent: string | null;
        requestInfo: import("@prisma/client/runtime/library").JsonValue | null;
    })[];
    affectedRecords: import("@prisma/client/runtime/library").JsonValue;
}>;
export declare const getStatistics: (params: {
    startDate?: string;
    endDate?: string;
}) => Promise<{
    totalBatches: number;
    experimentsByStatus: {
        status: import(".prisma/client").$Enums.ExperimentStatus;
        count: number;
    }[];
    reviewsByDecision: {
        decision: import(".prisma/client").$Enums.ReviewDecision;
        count: number;
    }[];
    totalDiscards: number;
    totalDiscardedQty: number | null;
}>;
export {};
