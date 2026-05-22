import { DatabaseConfig, TeaMaterialRecord, RecordStatus, StateChange, CheckResult, ImportBatch, Operator, AuditLog, DataSourceType } from '../models/types';
export declare class DatabaseService {
    private db;
    private config;
    constructor(config?: Partial<DatabaseConfig>);
    getConfig(): DatabaseConfig;
    isInitialized(): boolean;
    initialize(): Promise<void>;
    private createTables;
    private createDefaultOperator;
    close(): Promise<void>;
    getOperatorById(id: string): Promise<Operator | null>;
    insertOperator(operator: Operator): Promise<void>;
    insertImportBatch(batch: ImportBatch): Promise<void>;
    getImportBatchByHash(fileHash: string): Promise<ImportBatch | null>;
    insertRecord(record: TeaMaterialRecord): Promise<void>;
    updateRecordStatus(recordId: string, status: RecordStatus): Promise<void>;
    insertStateChange(change: StateChange): Promise<void>;
    insertCheckResult(result: CheckResult): Promise<void>;
    getRecordById(id: string): Promise<TeaMaterialRecord | null>;
    getStateChangesByRecordId(recordId: string): Promise<StateChange[]>;
    getCheckResultsByRecordId(recordId: string): Promise<CheckResult[]>;
    insertAuditLog(log: AuditLog): Promise<void>;
    getAllRecords(filters?: {
        status?: RecordStatus;
        sourceType?: DataSourceType;
        batchId?: string;
        includeDeleted?: boolean;
    }): Promise<TeaMaterialRecord[]>;
    getAuditLogs(limit?: number): Promise<AuditLog[]>;
    getImportBatches(limit?: number): Promise<ImportBatch[]>;
    updateImportBatch(batchId: string, updates: Partial<ImportBatch>): Promise<void>;
    runQuery<T = any>(sql: string, params?: any[]): Promise<T[]>;
}
export declare const dbService: DatabaseService;
