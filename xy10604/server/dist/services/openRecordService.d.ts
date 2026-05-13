import { OpenRecord } from '@prisma/client';
interface CreateOpenRecordParams {
    batchId: string;
    openDate: Date;
    notes?: string;
    createdBy: string;
}
export declare const createOpenRecord: (params: CreateOpenRecordParams) => Promise<OpenRecord>;
export declare const updateOpenRecord: (id: string, updates: {
    openDate?: Date;
    notes?: string;
}, userId: string) => Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
    batchId: string;
    openDate: Date;
    expectedExpiry: Date;
    actualExpiry: Date | null;
    isOpened: boolean;
    notes: string | null;
}>;
export declare const closeOpenRecord: (id: string, userId: string) => Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
    batchId: string;
    openDate: Date;
    expectedExpiry: Date;
    actualExpiry: Date | null;
    isOpened: boolean;
    notes: string | null;
}>;
export declare const getOpenRecords: (params: {
    page?: number;
    limit?: number;
    batchId?: string;
    isOpened?: boolean;
}) => Promise<{
    records: ({
        createdBy: {
            id: string;
            username: string;
            name: string;
        };
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
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string;
        batchId: string;
        openDate: Date;
        expectedExpiry: Date;
        actualExpiry: Date | null;
        isOpened: boolean;
        notes: string | null;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare const getOpenRecordById: (id: string) => Promise<({
    experiments: {
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
    }[];
    createdBy: {
        id: string;
        username: string;
        name: string;
    };
    blockRecords: {
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
    }[];
    reviewRecords: ({
        reviewer: {
            id: string;
            username: string;
            name: string;
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
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
    batchId: string;
    openDate: Date;
    expectedExpiry: Date;
    actualExpiry: Date | null;
    isOpened: boolean;
    notes: string | null;
}) | null>;
export {};
