import { ConsumptionRecord, UnifiedResult, ImportBatch } from './types';
export declare class UnifiedResultStore {
    private records;
    private batches;
    setRecords(records: ConsumptionRecord[]): void;
    getRecords(): ConsumptionRecord[];
    setBatches(batches: ImportBatch[]): void;
    getBatches(): ImportBatch[];
    addBatch(batch: ImportBatch): void;
    updateRecord(id: string, updates: Partial<ConsumptionRecord>): void;
    generateUnifiedResult(): UnifiedResult;
    getForPageDisplay(): UnifiedResult;
    getForExport(): any[];
    getForApiResponse(): UnifiedResult;
    getRecordEvidence(recordId: string): any;
}
export declare const unifiedStore: UnifiedResultStore;
