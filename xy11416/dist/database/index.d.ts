import { RawRecord, StandardizedRecord, FactRecord, ValidationError, RecordStatus, ImportSession } from '../types';
export declare class DatabaseManager {
    private db;
    private dbPath;
    constructor(workDir: string);
    initSchema(): Promise<void>;
    run(sql: string, params?: any[]): Promise<void>;
    get<T = any>(sql: string, params?: any[]): Promise<T | null>;
    all<T = any>(sql: string, params?: any[]): Promise<T[]>;
    createImportSession(session: Omit<ImportSession, 'startedAt' | 'status' | 'processedRecords'>): Promise<ImportSession>;
    updateImportSession(batchId: string, processed: number, status: 'running' | 'completed' | 'failed'): Promise<void>;
    insertRawRecord(record: Omit<RawRecord, 'id' | 'importedAt' | 'isDeleted'>): Promise<RawRecord>;
    findRawRecordByFingerprint(sourceFile: string, rawLineNumber: number, batchId: string): Promise<RawRecord | null>;
    findFactByOrderNumber(orderNumber: string): Promise<FactRecord | null>;
    createFactRecord(orderNumber: string, status: string): Promise<FactRecord>;
    updateFactRecord(factId: string, updates: Partial<FactRecord>): Promise<void>;
    insertStandardizedRecord(record: Omit<StandardizedRecord, 'id'>): Promise<StandardizedRecord>;
    insertValidationError(error: Omit<ValidationError, 'id' | 'createdAt' | 'resolved'>): Promise<ValidationError>;
    resolveValidationError(errorId: string, resolvedBy: string, resolution: string): Promise<void>;
    getUnresolvedErrors(recordId?: string): Promise<ValidationError[]>;
    getFailedRecords(batchId?: string): Promise<(RawRecord & {
        errors: string[];
    })[]>;
    getImportHistory(limit?: number): Promise<ImportSession[]>;
    getSessionById(batchId: string): Promise<ImportSession | null>;
    getRawRecordsByBatch(batchId: string): Promise<RawRecord[]>;
    getStandardizedRecordsByFact(factId: string): Promise<StandardizedRecord[]>;
    getFactRecords(includeFrozen?: boolean): Promise<FactRecord[]>;
    updateRawRecordStatus(id: string, status: RecordStatus): Promise<void>;
    logChange(factId: string, fieldName: string, oldValue: string | undefined, newValue: string | undefined, changedBy: string, reason: string): Promise<void>;
    private mapRawRecord;
    private mapStandardizedRecord;
    private mapFactRecord;
    private mapValidationError;
    private mapImportSession;
    close(): Promise<void>;
}
export declare function getDatabase(workDir: string): DatabaseManager;
