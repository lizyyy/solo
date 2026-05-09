import { DatabaseConnection } from './database';
import * as Types from './types';
export declare class HistoryRepository {
    private db;
    constructor(dbConnection?: DatabaseConnection);
    record(entityType: Types.OperationHistory['entityType'], entityId: string, operationType: Types.OperationHistory['operationType'], source: Types.RecordSource, options?: {
        beforeData?: any;
        afterData?: any;
        reason?: string;
        operator?: string;
        batchId?: string;
    }): string;
    getHistory(entityType: Types.OperationHistory['entityType'], entityId: string): Types.OperationHistory[];
    private rowToHistory;
}
export declare class ParkingRecordRepository {
    private db;
    private historyRepo;
    constructor(dbConnection?: DatabaseConnection);
    create(record: Omit<Types.ParkingRecord, 'id' | 'createdAt' | 'recognizedPlates'>, source: Types.RecordSource, options?: {
        batchId?: string;
        operator?: string;
    }): string;
    findById(id: string): Types.ParkingRecord | null;
    findByPlate(plateNumber: string): Types.ParkingRecord[];
    findByBatch(batchId: string): Types.ParkingRecord[];
    findUnpaid(): Types.ParkingRecord[];
    updatePayment(id: string, paidAmount: number, operator?: string): void;
    private rowToRecord;
}
export declare class ArrearsGroupRepository {
    private db;
    private historyRepo;
    constructor(dbConnection?: DatabaseConnection);
    create(group: Omit<Types.ArrearsGroup, 'id' | 'createdAt' | 'updatedAt'>, source: Types.RecordSource, options?: {
        batchId?: string;
        operator?: string;
    }): string;
    findById(id: string): Types.ArrearsGroup | null;
    findByPlate(plate: string): Types.ArrearsGroup | null;
    findByStatus(status: Types.ArrearsStatus): Types.ArrearsGroup[];
    update(id: string, updates: Partial<Types.ArrearsGroup>, source: Types.RecordSource, options?: {
        reason?: string;
        operator?: string;
        batchId?: string;
    }): void;
    withdraw(id: string, reason: string, operator?: string): void;
    private rowToGroup;
}
export declare class CollectionRecordRepository {
    private db;
    constructor(dbConnection?: DatabaseConnection);
    create(record: Omit<Types.CollectionRecord, 'id'>, options?: {
        batchId?: string;
        operator?: string;
    }): string;
    findByArrearsGroup(arrearsGroupId: string): Types.CollectionRecord[];
    private rowToRecord;
}
export declare class PaymentCallbackRepository {
    private db;
    private historyRepo;
    constructor(dbConnection?: DatabaseConnection);
    create(callback: Omit<Types.PaymentCallback, 'id' | 'processed' | 'processedAt'>, source: Types.RecordSource, options?: {
        batchId?: string;
        operator?: string;
    }): string | null;
    findByExternalOrder(externalOrderId: string): Types.PaymentCallback | null;
    findUnprocessed(): Types.PaymentCallback[];
    markProcessed(id: string, arrearsGroupId?: string): void;
    private rowToCallback;
}
export declare class BlacklistRepository {
    private db;
    private historyRepo;
    constructor(dbConnection?: DatabaseConnection);
    add(record: Omit<Types.BlacklistRecord, 'id'>, source: Types.RecordSource, options?: {
        operator?: string;
    }): string;
    findByArrearsGroup(arrearsGroupId: string): Types.BlacklistRecord | null;
    findActive(): Types.BlacklistRecord[];
    remove(arrearsGroupId: string, source: Types.RecordSource, options?: {
        reason?: string;
        operator?: string;
    }): void;
    updateSyncStatus(arrearsGroupId: string, syncStatus: 'synced' | 'pending' | 'failed', syncMessage?: string): void;
    private rowToRecord;
}
export declare class ReportRepository {
    private db;
    constructor(dbConnection?: DatabaseConnection);
    create(report: Omit<Types.CollectionReport, 'id'>): string;
    getLatest(): Types.CollectionReport | null;
}
export declare class BatchRepository {
    private db;
    constructor(dbConnection?: DatabaseConnection);
    create(batch: Omit<Types.BatchOperation, 'id' | 'status' | 'successCount' | 'failedCount' | 'startedAt'>): string;
    updateProgress(id: string, successCount: number, failedCount: number): void;
    complete(id: string, summary: string): void;
    fail(id: string, error: string): void;
}
