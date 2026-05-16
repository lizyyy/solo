import { QueryFilter } from './types';
export type ExportFormat = 'csv' | 'xlsx' | 'json';
export interface ExportOptions {
    format: ExportFormat;
    outputPath?: string;
    filter?: QueryFilter;
    markExported?: boolean;
    includeRawData?: boolean;
}
export declare function exportAbnormalSamples(options: ExportOptions): Promise<{
    filePath: string;
    count: number;
}>;
export declare function exportRenewalReport(batchId: string, outputPath?: string): Promise<string>;
export declare function getExportFormatHelp(): string;
