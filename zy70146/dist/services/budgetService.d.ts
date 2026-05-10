export declare const budgetService: {
    getOrCreateBudget(sloConfigId: string, referenceTime?: Date): Promise<{
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
    }>;
    deductFromBudget(sloConfigId: string, errorSampleId: string, options?: {
        reason?: string;
        metadata?: any;
        operator?: string;
    }): Promise<{
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
    }>;
    getBudgetStatus(sloConfigId: string, referenceTime?: Date): Promise<{
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
        freezes: {
            id: string;
            description: string | null;
            tenantId: string;
            isActive: boolean;
            frozenAt: Date;
            reason: string;
            budgetId: string;
            frozenBy: string | null;
            unfrozenAt: Date | null;
            unfrozenBy: string | null;
            unfreezeReason: string | null;
        }[];
        suppressions: {
            id: string;
            tenantId: string;
            isActive: boolean;
            reason: string;
            budgetId: string;
            alertType: string;
            suppressedBy: string | null;
            suppressedAt: Date;
            expiresAt: Date | null;
            unsuppressedAt: Date | null;
        }[];
        recentDeductions: ({
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
        } & {
            id: string;
            reason: string | null;
            errorSampleId: string;
            deductedAt: Date;
            deductedAmount: number;
            budgetId: string;
        })[];
        utilization: {
            percentage: number;
            remainingPercentage: number;
            isDepleted: boolean;
            isWarning: boolean;
        };
    }>;
    listBudgets(tenantId: string, options?: {
        isFrozen?: boolean;
        windowType?: string;
        limit?: number;
    }): Promise<({
        sloConfig: {
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
    } & {
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
    })[]>;
};
