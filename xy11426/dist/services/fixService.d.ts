export interface FixRecordOptions {
    recordId: string;
    field: string;
    newValue: string;
    operator: string;
    reason: string;
}
export interface FixResult {
    recordId: string;
    originalLineNo: number;
    visitorName: string;
    field: string;
    oldValue: string;
    newValue: string;
    reason: string;
}
export declare function fixRecord(options: FixRecordOptions): FixResult;
export declare function batchFix(batchId: string, fixes: FixRecordOptions[]): FixResult[];
export declare function getFixedRecords(batchId: string): any[];
export declare function autoFixBySuggestion(batchId: string, operator: string): FixResult[];
