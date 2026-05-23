import { DataSourceType, ImportStrategy, ImportOptions, RecordStatus } from '../types';
export interface ImportResult {
    batchId: string;
    totalRecords: number;
    importedRecords: number;
    skippedRecords: number;
    strategy: ImportStrategy;
}
export interface RawRecord {
    originalLineNo: number;
    data: Record<string, any>;
}
export declare function readCSV(filePath: string, skipHeader?: boolean): Promise<RawRecord[]>;
export declare function readExcel(filePath: string): RawRecord[];
export declare function readFile(filePath: string, skipHeader?: boolean): Promise<RawRecord[]>;
export declare function mapRecord(raw: RawRecord, sourceType: DataSourceType): any;
export declare function createBatch(filePath: string, options: ImportOptions): string;
export declare function processImportStrategy(batchId: string, sourceType: DataSourceType, strategy: ImportStrategy, operator: string): void;
export declare function insertRecords(batchId: string, rawRecords: RawRecord[], sourceType: DataSourceType, operator: string): {
    total: number;
    success: number;
    failed: number;
};
export declare function importFile(filePath: string, options: ImportOptions): Promise<ImportResult>;
export declare function getBatch(batchId: string): any;
export declare function getBatches(sourceType?: DataSourceType, limit?: number): any[];
export declare function getBatchRecords(batchId: string, status?: RecordStatus): any[];
