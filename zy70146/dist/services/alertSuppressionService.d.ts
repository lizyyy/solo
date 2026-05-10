export declare const alertSuppressionService: {
    suppressAlert(budgetId: string, alertType: string, reason: string, options?: {
        expiresAt?: Date;
        operator?: string;
    }): Promise<{
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
    }>;
    unsuppressAlert(suppressionId: string, options?: {
        operator?: string;
    }): Promise<{
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
    }>;
    listSuppressions(tenantId: string, options?: {
        isActive?: boolean;
        budgetId?: string;
        alertType?: string;
        limit?: number;
    }): Promise<({
        budget: {
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
        };
    } & {
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
    })[]>;
    isAlertSuppressed(budgetId: string, alertType: string): Promise<boolean>;
    getActiveSuppressions(budgetId: string): Promise<{
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
    }[]>;
};
