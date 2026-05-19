import { WorkRecord, AuditLog, BillingConfig } from '../types';
export declare class DataStore {
    private records;
    private auditLogs;
    private config;
    constructor();
    private ensureDataDirectory;
    private loadData;
    private saveData;
    getConfig(): BillingConfig;
    updateConfig(config: Partial<BillingConfig>, operator: string): BillingConfig;
    addRecord(record: Omit<WorkRecord, 'id' | 'createdAt' | 'updatedAt'>, operator: string): WorkRecord;
    updateRecord(id: string, updates: Partial<WorkRecord>, operator: string): WorkRecord | null;
    getRecordById(id: string): WorkRecord | undefined;
    getRecordByRecordNo(recordNo: string): WorkRecord | undefined;
    getAllRecords(): WorkRecord[];
    addAuditLog(action: string, operator: string, details?: Record<string, any>): AuditLog;
    getAuditLogs(filter?: {
        recordId?: string;
        action?: string;
        operator?: string;
    }): AuditLog[];
    recordExists(recordNo: string): boolean;
}
export declare const dataStore: DataStore;
