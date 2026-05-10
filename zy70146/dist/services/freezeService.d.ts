import { FreezeReason } from '../types/enums';
export declare const freezeService: {
    freezeBudget(budgetId: string, reason: FreezeReason, options?: {
        description?: string;
        operator?: string;
    }): Promise<{
        freeze: {
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
        };
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
    }>;
    unfreezeBudget(budgetId: string, options?: {
        reason?: string;
        operator?: string;
    }): Promise<{
        unfrozenFreezes: {
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
    }>;
    listFreezes(tenantId: string, options?: {
        isActive?: boolean;
        budgetId?: string;
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
    })[]>;
    getActiveFreeze(budgetId: string): Promise<{
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
    } | null>;
};
