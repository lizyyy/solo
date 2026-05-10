export declare const reportService: {
    generateBudgetReport(tenantId: string, options?: {
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<{
        generatedAt: Date;
        tenantId: string;
        totalBudgets: number;
        frozenBudgets: number;
        exhaustedBudgets: number;
        warningBudgets: number;
        healthyBudgets: number;
        details: {
            id: string;
            sloConfig: {
                id: string;
                name: string;
                type: string;
                targetValue: number;
            };
            service: {
                id: string;
                name: string;
            } | null;
            endpoint: {
                id: string;
                method: string;
                path: string;
            } | null;
            window: {
                type: string;
                start: Date;
                end: Date;
            };
            budget: {
                total: number;
                used: number;
                remaining: number;
                utilizationPercent: number;
            };
            isFrozen: boolean;
            frozenReason: string | null;
            deductionCount: number;
        }[];
    }>;
    getErrorTrend(tenantId: string, options?: {
        days?: number;
        serviceId?: string;
        endpointId?: string;
    }): Promise<{
        period: {
            start: Date;
            end: Date;
        };
        totalErrors: number;
        deductedErrors: number;
        dailyStats: Record<string, {
            total: number;
            deducted: number;
            sources: Record<string, number>;
        }>;
    }>;
    getSLOCompliance(tenantId: string, sloConfigId: string): Promise<{
        sloConfig: {
            id: string;
            name: string;
            type: string;
            targetValue: number;
            timeWindowType: string;
        };
        compliance: {
            target: number;
            achieved: number;
            isCompliant: boolean;
            delta: number;
        };
        history: {
            windowStart: Date;
            windowEnd: Date;
            totalBudget: number;
            usedBudget: number;
            remainingBudget: number;
            achievementRate: number;
        }[];
    }>;
    getProcessBlockers(tenantId: string): Promise<{
        totalBlockers: number;
        blockers: {
            id: string;
            step: string;
            status: string;
            checkpoint: string | null;
            message: string | null;
            createdAt: Date;
            operator: string | null;
            sloConfig: {
                id: string;
                name: string;
            } | null;
            metadata: any;
        }[];
    }>;
};
