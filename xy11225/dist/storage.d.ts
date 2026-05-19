import { FaultRecord, BatchOperationResult, FilterOptions } from './types';
export declare class Storage {
    private data;
    constructor();
    private ensureStorageExists;
    private loadData;
    private saveData;
    generateId(): string;
    addRecord(record: Omit<FaultRecord, 'id' | 'createdAt' | 'updatedAt'>): FaultRecord;
    updateRecord(id: string, updates: Partial<FaultRecord>): FaultRecord | null;
    getRecord(id: string): FaultRecord | undefined;
    getRecords(filter?: FilterOptions): FaultRecord[];
    getRecordsByCabinet(cabinetId: string): FaultRecord[];
    deleteRecord(id: string): boolean;
    setCabinetOffline(cabinetId: string, isOffline: boolean): void;
    isCabinetOffline(cabinetId: string): boolean;
    addBatchResult(batch: Omit<BatchOperationResult, 'batchId' | 'createdAt'>): BatchOperationResult;
    getBatchResult(batchId: string): BatchOperationResult | undefined;
    getAllBatches(): BatchOperationResult[];
    getStatistics(): {
        totalRecords: number;
        pendingRecords: number;
        resolvedRecords: number;
        offlineCabinets: number;
        totalBatches: number;
    };
}
export declare const storage: Storage;
