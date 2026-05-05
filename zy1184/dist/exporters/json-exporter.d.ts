import { AnalysisResult, SimulationResult } from '../models';
interface ExportOptions {
    includeSql?: boolean;
    includeSuggestions?: boolean;
}
export declare function exportJson(analysisResults: AnalysisResult[], simulationResults?: SimulationResult[], options?: ExportOptions): string;
export {};
//# sourceMappingURL=json-exporter.d.ts.map