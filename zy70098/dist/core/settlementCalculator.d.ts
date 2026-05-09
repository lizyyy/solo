import { DeviationResult, OperationResult, SettlementStatus } from '../types';
export interface SettlementCalculationConfig {
    minimumPayout: number;
    penaltyMultiplier: number;
    bonusMultiplier: number;
}
export declare const DEFAULT_SETTLEMENT_CONFIG: SettlementCalculationConfig;
export interface SettlementInput {
    enrollmentId: string;
    batchId: string;
    enterpriseId: string;
    deviationResult: DeviationResult;
    unitPrice: number;
    config?: SettlementCalculationConfig;
}
export declare function calculateSettlementAmount(input: SettlementInput): OperationResult<{
    settlementAmount: number;
    reductionAmount: number;
    deviationRate: number;
}>;
export declare function determineSettlementStatus(deviationResult: DeviationResult, hasSettlementErrors: boolean): SettlementStatus;
export interface SettlementSummary {
    totalEnrollments: number;
    passedEnrollments: number;
    failedEnrollments: number;
    totalSettlementAmount: number;
    totalReductionAmount: number;
    averageDeviationRate: number;
}
export declare function calculateSettlementSummary(results: Array<{
    deviationResult: DeviationResult;
    settlementAmount: number;
    reductionAmount: number;
}>): SettlementSummary;
