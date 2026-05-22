import { DatabaseManager } from '../database';
import { SourceType, ImportResult, ImportMode } from '../types';
export interface ImportOptions {
    mode?: ImportMode;
    batchId?: string;
    operator?: string;
    sourceType?: SourceType;
}
export declare class ImportService {
    private db;
    private workDir;
    constructor(db: DatabaseManager, workDir: string);
    importFile(filePath: string, options?: ImportOptions): Promise<ImportResult>;
    private processRow;
    private detectSourceType;
    private determineStatus;
    withdrawRecord(rawRecordId: string, operator: string): Promise<boolean>;
}
