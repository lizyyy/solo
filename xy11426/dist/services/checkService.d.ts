export interface CheckRule {
    name: string;
    type: string;
    check: (record: any) => {
        passed: boolean;
        message: string;
        suggestion?: string;
    };
}
export interface CheckResult {
    recordId: string;
    originalLineNo: number;
    visitorName: string;
    checkType: string;
    passed: boolean;
    message: string;
    suggestion?: string;
}
export declare const checkRules: CheckRule[];
export declare function saveCheckResult(batchId: string, recordId: string, checkType: string, passed: boolean, message: string): void;
export declare function checkRecord(record: any): CheckResult[];
export declare function checkBatch(batchId: string, operator: string): {
    total: number;
    valid: number;
    invalid: number;
    failures: CheckResult[];
};
export declare function getRecordCheckResults(recordId: string): any[];
export declare function getBatchCheckResults(batchId: string, passedOnly?: boolean): any[];
export declare function getFailedRecords(batchId: string): any[];
export declare function checkCrossSourceConsistency(): {
    total: number;
    inconsistent: number;
    details: any[];
};
