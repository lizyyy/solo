import { AnalysisResult } from '../models';
interface ExportOptions {
    includeSql?: boolean;
    includeSuggestions?: boolean;
}
export declare function exportCsv(analysisResults: AnalysisResult[], options?: ExportOptions): string;
export declare function exportSummaryCsv(analysisResults: AnalysisResult[]): string;
export {};
//# sourceMappingURL=csv-exporter.d.ts.map