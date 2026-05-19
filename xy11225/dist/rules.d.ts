import { FaultRecord, RuleValidationResult, ProcessingResult } from './types';
export declare class RuleEngine {
    private rules;
    constructor();
    private registerRules;
    private offlineCabinetRule;
    private duplicateFaultRule;
    private maintenanceStatusRule;
    validateRecord(record: FaultRecord): {
        overallResult: ProcessingResult;
        results: Array<{
            ruleName: string;
            validation: RuleValidationResult;
        }>;
        primaryReason: string;
        targetRecordId?: string;
    };
    processRecord(record: FaultRecord): {
        record: FaultRecord;
        overallResult: ProcessingResult;
        reason: string;
        mergedTo?: string;
    };
}
export declare const ruleEngine: RuleEngine;
