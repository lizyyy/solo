import { ExecutionRecord, DeviationResult, OperationResult } from '../types';
export interface DeviationCalculationConfig {
    passThreshold: number;
    minValidRecords: number;
}
export declare const DEFAULT_DEVIATION_CONFIG: DeviationCalculationConfig;
export declare function calculateDeviation(executionRecords: ExecutionRecord[], declaredCapacity: number, config?: DeviationCalculationConfig): OperationResult<DeviationResult>;
export declare function calculateAverage(values: number[]): number;
export interface DeviationValidationResult {
    isValid: boolean;
    warnings: string[];
    errors: string[];
}
export declare function validateExecutionRecords(executionRecords: ExecutionRecord[], batchStartTime: Date, batchEndTime: Date): DeviationValidationResult;
