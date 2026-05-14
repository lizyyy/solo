import { LogisticsInterception, BatchResult, BatchItem } from './types';
import { ResultStore } from './result-store';
export declare class BatchProcessor {
    private logisticsProcessor;
    private resultStore;
    constructor(resultStore?: ResultStore);
    preview(items: LogisticsInterception[]): BatchResult;
    execute(items: LogisticsInterception[], operator: string, skipPreview?: boolean): BatchResult;
    filterByFailureGroup(result: BatchResult, failureGroup: string): BatchItem[];
    private getReferenceSchema;
}
