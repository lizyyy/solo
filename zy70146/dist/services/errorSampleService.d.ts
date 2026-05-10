import { ErrorSource } from '../types/enums';
interface CreateErrorSampleOptions {
    tenantId: string;
    serviceId?: string;
    endpointId?: string;
    source: ErrorSource;
    errorType?: string;
    errorMessage?: string;
    statusCode?: number;
    timestamp?: Date;
    durationMs?: number;
    requestId?: string;
    userId?: string;
    metadata?: Record<string, any>;
    operator?: string;
}
export declare const errorSampleService: {
    create(options: CreateErrorSampleOptions): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        serviceId: string | null;
        metadata: string | null;
        endpointId: string | null;
        source: string;
        errorType: string | null;
        errorMessage: string | null;
        statusCode: number | null;
        timestamp: Date;
        durationMs: number | null;
        requestId: string | null;
        userId: string | null;
        isDeducted: boolean;
        deductedAt: Date | null;
    }>;
    list(tenantId: string, options?: {
        isDeducted?: boolean;
        serviceId?: string;
        endpointId?: string;
        source?: ErrorSource;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<{
        metadata: any;
        service: {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
        } | null;
        endpoint: {
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            method: string;
            path: string;
            serviceId: string;
        } | null;
        budgetDeductions: {
            id: string;
            reason: string | null;
            errorSampleId: string;
            deductedAt: Date;
            deductedAmount: number;
            budgetId: string;
        }[];
        id: string;
        createdAt: Date;
        tenantId: string;
        serviceId: string | null;
        endpointId: string | null;
        source: string;
        errorType: string | null;
        errorMessage: string | null;
        statusCode: number | null;
        timestamp: Date;
        durationMs: number | null;
        requestId: string | null;
        userId: string | null;
        isDeducted: boolean;
        deductedAt: Date | null;
    }[]>;
    getById(id: string): Promise<{
        metadata: any;
        service: {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
        } | null;
        endpoint: {
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            method: string;
            path: string;
            serviceId: string;
        } | null;
        budgetDeductions: ({
            budget: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                sloConfigId: string;
                windowStart: Date;
                windowEnd: Date;
                windowType: string;
                totalBudget: number;
                usedBudget: number;
                remainingBudget: number;
                isFrozen: boolean;
                frozenAt: Date | null;
                frozenReason: string | null;
            };
        } & {
            id: string;
            reason: string | null;
            errorSampleId: string;
            deductedAt: Date;
            deductedAmount: number;
            budgetId: string;
        })[];
        id: string;
        createdAt: Date;
        tenantId: string;
        serviceId: string | null;
        endpointId: string | null;
        source: string;
        errorType: string | null;
        errorMessage: string | null;
        statusCode: number | null;
        timestamp: Date;
        durationMs: number | null;
        requestId: string | null;
        userId: string | null;
        isDeducted: boolean;
        deductedAt: Date | null;
    } | null>;
    getPendingDeductions(tenantId: string): Promise<({
        service: {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
        } | null;
        endpoint: {
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            method: string;
            path: string;
            serviceId: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        serviceId: string | null;
        metadata: string | null;
        endpointId: string | null;
        source: string;
        errorType: string | null;
        errorMessage: string | null;
        statusCode: number | null;
        timestamp: Date;
        durationMs: number | null;
        requestId: string | null;
        userId: string | null;
        isDeducted: boolean;
        deductedAt: Date | null;
    })[]>;
    getMatchingSLOConfig(tenantId: string, serviceId?: string, endpointId?: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        serviceId: string | null;
        type: string;
        targetValue: number;
        timeWindowType: string;
        isActive: boolean;
        endpointId: string | null;
    }[]>;
    batchRecordAndDeduct(tenantId: string, serviceId: string | undefined, endpointId: string | undefined, errorData: Omit<CreateErrorSampleOptions, "tenantId" | "serviceId" | "endpointId">): Promise<{
        sloConfig: {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            serviceId: string | null;
            type: string;
            targetValue: number;
            timeWindowType: string;
            isActive: boolean;
            endpointId: string | null;
        };
        errorSample: {
            id: string;
            createdAt: Date;
            tenantId: string;
            serviceId: string | null;
            metadata: string | null;
            endpointId: string | null;
            source: string;
            errorType: string | null;
            errorMessage: string | null;
            statusCode: number | null;
            timestamp: Date;
            durationMs: number | null;
            requestId: string | null;
            userId: string | null;
            isDeducted: boolean;
            deductedAt: Date | null;
        };
        deductionResult: {
            budget: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                sloConfigId: string;
                windowStart: Date;
                windowEnd: Date;
                windowType: string;
                totalBudget: number;
                usedBudget: number;
                remainingBudget: number;
                isFrozen: boolean;
                frozenAt: Date | null;
                frozenReason: string | null;
            };
            deductionAmount: number;
            reason: string;
            remainingPercentage?: undefined;
        } | {
            budget: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                sloConfigId: string;
                windowStart: Date;
                windowEnd: Date;
                windowType: string;
                totalBudget: number;
                usedBudget: number;
                remainingBudget: number;
                isFrozen: boolean;
                frozenAt: Date | null;
                frozenReason: string | null;
            };
            deductionAmount: number;
            remainingPercentage: number;
            reason?: undefined;
        };
    }[]>;
};
export {};
