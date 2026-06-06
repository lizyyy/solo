import { TunerMessageRaw, GroupSignupRaw, ImportBatch, ConsumptionRecord } from './types';
export declare function parseTunerMessage(lines: string[], batchId: string, operator: string): {
    batch: ImportBatch;
    records: TunerMessageRaw[];
};
export declare function parseGroupSignup(lines: string[], batchId: string, operator: string): {
    batch: ImportBatch;
    records: GroupSignupRaw[];
};
export declare function createConsumptionRecordsFromTuner(tunerRecords: TunerMessageRaw[]): ConsumptionRecord[];
export declare function mergeGroupSignupToRecords(existingRecords: ConsumptionRecord[], groupRecords: GroupSignupRaw[]): ConsumptionRecord[];
