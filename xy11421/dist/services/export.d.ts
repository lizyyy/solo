import { SourceType } from '../types';
export interface ExportOptions {
    sourceType?: SourceType;
    status?: string;
    batchId?: string;
    includeDirty?: boolean;
    outputPath: string;
}
export declare function exportData(options: ExportOptions): Promise<void>;
export declare function exportFailedRecords(batchId: string, outputPath: string): Promise<void>;
