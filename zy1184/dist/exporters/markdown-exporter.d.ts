import { AnalysisResult, SimulationResult } from '../models';
interface ExportOptions {
    includeSql?: boolean;
    includeSuggestions?: boolean;
}
export declare function exportMarkdown(analysisResults: AnalysisResult[], simulationResults?: SimulationResult[], options?: ExportOptions): string;
export {};
//# sourceMappingURL=markdown-exporter.d.ts.map