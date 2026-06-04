import { ProcessingResult } from '../types';
export interface ImportOptions {
    filePath: string;
    importedBy: string;
    valueColumns: string[];
    screenshotRef?: string;
    hasHeader?: boolean;
    delimiter?: string;
}
export interface ImportSummary {
    totalRows: number;
    importedCount: number;
    mixedFormatCount: number;
    pendingReviewCount: number;
    autoNormalizedCount: number;
    errors: string[];
    importedRecordIds: string[];
}
export declare function importCsv(options: ImportOptions): ProcessingResult<ImportSummary>;
