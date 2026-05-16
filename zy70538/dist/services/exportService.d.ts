import { CacheExplanation } from '../types';
export declare class ExportService {
    private exportDir;
    constructor();
    private ensureExportDir;
    exportToCSV(explanations: CacheExplanation[]): string;
    exportToJSON(explanations: CacheExplanation[]): string;
    private getStatusDisplayName;
    generateDetailedReport(explanation: CacheExplanation): Record<string, unknown>;
}
export declare const exportService: ExportService;
