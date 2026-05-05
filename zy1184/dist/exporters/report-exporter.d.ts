import { AnalysisResult, SimulationResult } from '../models';
import { exportMarkdown } from './markdown-exporter';
import { exportJson } from './json-exporter';
import { exportCsv, exportSummaryCsv } from './csv-exporter';
interface ExportOptions {
    includeSql?: boolean;
    includeSuggestions?: boolean;
    format?: 'markdown' | 'json' | 'csv';
}
export declare function exportReport(analysisResults: AnalysisResult[], simulationResults?: SimulationResult[], options?: ExportOptions): string;
export declare function exportReportsBatch(analysisResults: AnalysisResult[], simulationResults?: SimulationResult[], options?: ExportOptions & {
    formats?: ('markdown' | 'json' | 'csv')[];
}): Record<string, string>;
export { exportMarkdown, exportJson, exportCsv, exportSummaryCsv, };
//# sourceMappingURL=report-exporter.d.ts.map