import { DiscardRecord, DiscardReason } from '@prisma/client';
interface CreateDiscardParams {
    batchId: string;
    reason: DiscardReason;
    details?: string;
    discardedQty: number;
    createdBy: string;
}
export declare const createDiscard: (params: CreateDiscardParams) => Promise<DiscardRecord>;
export declare const getDiscardRecords: (params: {
    page?: number;
    limit?: number;
    batchId?: string;
    reason?: DiscardReason;
    startDate?: string;
    endDate?: string;
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
        createdById: string;
        batchId: string;
        discardedAt: Date;
        reason: import(".prisma/client").$Enums.DiscardReason;
        details: string | null;
        discardedQty: number;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare const getDiscardStatistics: (params: {
    startDate?: string;
    endDate?: string;
    reagentId?: string;
}) => Promise<{
    totalRecords: number;
    totalQty: number;
    byReason: Record<string, {
        count: number;
        qty: number;
    }>;
    byReagent: Record<string, {
        name: string;
        count: number;
        qty: number;
    }>;
}>;
export declare const getDiscardById: (id: string) => Promise<({
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
    createdById: string;
    batchId: string;
    discardedAt: Date;
    reason: import(".prisma/client").$Enums.DiscardReason;
    details: string | null;
    discardedQty: number;
}) | null>;
export {};
