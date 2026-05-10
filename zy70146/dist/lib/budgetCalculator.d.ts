import { SLOType, TimeWindowType } from '../types/enums';
export declare function calculateTotalBudget(sloType: SLOType, targetValue: number, windowType: TimeWindowType, totalRequests?: number): number;
export declare function calculateDeductionAmount(sloType: SLOType, metadata?: {
    statusCode?: number;
    durationMs?: number;
    expectedDurationMs?: number;
}): number;
export declare function calculateBudgetPercentage(remaining: number, total: number): number;
export declare function calculateBudgetUtilization(used: number, total: number): number;
