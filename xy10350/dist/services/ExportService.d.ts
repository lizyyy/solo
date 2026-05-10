import { ReplayResult, DiffReport, ExportConfig } from '../types';
export declare class ExportService {
    private config;
    constructor(config?: ExportConfig);
    exportReplayResults(results: ReplayResult[], outputPath: string): string;
    exportDiffReports(diffs: DiffReport[], outputPath: string): string;
    private exportAsJSON;
    private exportDiffsAsJSON;
    private exportAsCSV;
    private exportDiffsAsCSV;
    private buildKeyMetrics;
    private buildKeyMetricsText;
    private buildDiffMetrics;
    private escapeCSV;
}
//# sourceMappingURL=ExportService.d.ts.map