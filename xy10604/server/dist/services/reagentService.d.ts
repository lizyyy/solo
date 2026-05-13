import { Reagent, ReagentBatch, ReagentStatus } from '@prisma/client';
interface CreateReagentParams {
    name: string;
    code: string;
    description?: string;
    defaultExpiryDays?: number;
    nearExpiryDays?: number;
    createdBy: string;
}
interface UpdateReagentParams {
    name?: string;
    description?: string;
    defaultExpiryDays?: number;
    nearExpiryDays?: number;
    isActive?: boolean;
}
export declare const createReagent: (params: CreateReagentParams) => Promise<Reagent>;
export declare const updateReagent: (id: string, params: UpdateReagentParams, userId: string) => Promise<Reagent>;
export declare const getReagents: (params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
}) => Promise<{
    reagents: ({
        batches: {
            id: string;
            batchNumber: string;
            status: import(".prisma/client").$Enums.ReagentStatus;
        }[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        code: string;
        description: string | null;
        defaultExpiryDays: number;
        nearExpiryDays: number;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare const getReagentById: (id: string) => Promise<({
    batches: {
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
    }[];
} & {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    code: string;
    description: string | null;
    defaultExpiryDays: number;
    nearExpiryDays: number;
}) | null>;
interface CreateBatchParams {
    reagentId: string;
    batchNumber: string;
    productionDate: Date;
    expiryDate: Date;
    originalQty: number;
    unit: string;
    createdBy: string;
}
export declare const createBatch: (params: CreateBatchParams) => Promise<ReagentBatch>;
export declare const getBatches: (params: {
    page?: number;
    limit?: number;
    reagentId?: string;
    status?: ReagentStatus;
    search?: string;
}) => Promise<{
    batches: ({
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
        openRecords: {
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
        }[];
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
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare const getBatchById: (id: string) => Promise<({
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
    openRecords: {
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
    }[];
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
    discardRecords: {
        id: string;
        createdAt: Date;
        createdById: string;
        batchId: string;
        discardedAt: Date;
        reason: import(".prisma/client").$Enums.DiscardReason;
        details: string | null;
        discardedQty: number;
    }[];
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
}) | null>;
export {};
