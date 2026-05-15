import { ChangeRecord, ManualCorrection, Batch, QueryFilter } from '../types';
export declare class ChangeIndexDB {
    private db;
    constructor(dbPath?: string);
    init(): Promise<void>;
    insertBatch(batch: Batch): Promise<void>;
    insertRecord(record: ChangeRecord): Promise<void>;
    insertCorrection(correction: ManualCorrection): Promise<void>;
    updateRecord(record: ChangeRecord): Promise<void>;
    getRecords(filter?: QueryFilter): ChangeRecord[];
    getRecordById(id: string): ChangeRecord | null;
    getBatches(): Batch[];
    getBatchById(id: string): Batch | null;
    getCorrectionsByRecordId(recordId: string): ManualCorrection[];
    getCorrectionsByApprovalNode(approvalNode: string): ManualCorrection[];
    close(): void;
}
export declare function createDB(dbPath?: string): Promise<ChangeIndexDB>;
