import { ConsumptionRecord, SelfCheckResult, SelfCheckIssue, ImportBatch } from './types';
export declare function detectDuplicates(records: ConsumptionRecord[]): SelfCheckIssue[];
export declare function detectTempSubstitutes(records: ConsumptionRecord[]): SelfCheckIssue[];
export declare function detectMismatches(records: ConsumptionRecord[]): SelfCheckIssue[];
export declare function detectMissingData(records: ConsumptionRecord[]): SelfCheckIssue[];
export declare function verifyExportConsistency(records: ConsumptionRecord[], exportedData: any[]): SelfCheckIssue[];
export declare function recalculateAfterSupplement(records: ConsumptionRecord[]): ConsumptionRecord[];
export declare function runSelfCheck(records: ConsumptionRecord[], batches: ImportBatch[], exportedData?: any[]): SelfCheckResult;
export declare function markDuplicates(records: ConsumptionRecord[]): ConsumptionRecord[];
