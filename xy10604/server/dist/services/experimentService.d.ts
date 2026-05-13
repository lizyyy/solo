import { Experiment, ExperimentStatus, BlockReason } from '@prisma/client';
interface CreateExperimentParams {
    name: string;
    code: string;
    batchId: string;
    scheduledDate: Date;
    createdBy: string;
}
export interface ValidationResult {
    valid: boolean;
    blocked: boolean;
    blockReason?: BlockReason;
    blockDetails?: string;
    warnings?: string[];
}
export declare const validateExperiment: (batchId: string, scheduledDate: Date) => Promise<ValidationResult>;
export declare const createExperiment: (params: CreateExperimentParams, applyValidation?: boolean) => Promise<{
    experiment: Experiment;
    validation: ValidationResult;
}>;
export declare const updateExperimentStatus: (id: string, status: ExperimentStatus, userId: string) => Promise<{
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
}>;
export declare const getExperiments: (params: {
    page?: number;
    limit?: number;
    batchId?: string;
    status?: ExperimentStatus;
    startDate?: string;
    endDate?: string;
}) => Promise<{
    experiments: ({
        openRecord: {
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
        } | null;
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
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare const getExperimentById: (id: string) => Promise<({
    openRecord: {
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
    } | null;
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
}) | null>;
export {};
