import { ReturnStatus } from '../types';
export interface ExportOptions {
    startDate?: Date;
    endDate?: Date;
    status?: ReturnStatus[];
    includeArchived?: boolean;
}
export declare class ExportService {
    private static exportDir;
    static ensureExportDir(): Promise<void>;
    static exportBatchesToCSV(options?: ExportOptions): Promise<string>;
    static exportFinancialSummaryToCSV(): Promise<string>;
    static exportBatchDetailToCSV(batchId: string): Promise<string>;
    static getExportFiles(): Promise<{
        name: string;
        path: string;
        size: number;
        createdAt: Date;
    }[]>;
}
