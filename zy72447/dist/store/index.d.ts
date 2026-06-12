import { ReconciliationState, GroupSignupRecord, ContractRecord, ReconciliationResult, OperationLog, ImportBatch } from '../types';
export declare class ReconciliationStore {
    private state;
    private dataFile;
    constructor(dataFile?: string);
    private loadState;
    private saveState;
    private logOperation;
    getState(): Readonly<ReconciliationState>;
    addGroupRecords(records: Omit<GroupSignupRecord, 'id' | 'importedAt' | 'status' | 'manualEdits'>[], batchId: string, operator: string): GroupSignupRecord[];
    addContractRecords(records: Omit<ContractRecord, 'id' | 'importedAt' | 'status' | 'manualEdits'>[], batchId: string, operator: string): ContractRecord[];
    addBatch(batch: Omit<ImportBatch, 'id' | 'importedAt'>): ImportBatch;
    addResult(result: Omit<ReconciliationResult, 'id' | 'createdAt' | 'updatedAt'>, operator: string): ReconciliationResult;
    updateResult(resultId: string, updates: Partial<ReconciliationResult>, operator: string, notes?: string): ReconciliationResult | undefined;
    updateGroupRecord(recordId: string, updates: Partial<GroupSignupRecord>, operator: string, editReason?: string): GroupSignupRecord | undefined;
    updateContractRecord(recordId: string, updates: Partial<ContractRecord>, operator: string, editReason?: string): ContractRecord | undefined;
    findGroupRecordByRowAndBatch(rowNumber: number, batchId: string): GroupSignupRecord | undefined;
    getResultsWithDetails(options?: {
        includeSuperseded?: boolean;
    }): Array<{
        result: ReconciliationResult;
        groupRecord?: GroupSignupRecord;
        contractRecord?: ContractRecord;
    }>;
    getLogsForEntity(entityId: string): OperationLog[];
    exportState(): ReconciliationState;
    resetState(operator: string): void;
    rollbackBatch(batchId: string, operator: string, reason?: string): {
        affectedGroupRecords: number;
        affectedContractRecords: number;
        affectedResults: number;
    };
}
export declare const defaultStore: ReconciliationStore;
