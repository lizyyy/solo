import { AnalysisResult, ReportConfig } from './types';
export declare function generateTerminalSummary(result: AnalysisResult, verbose?: boolean): string;
export declare function generateJsonReport(result: AnalysisResult): string;
export declare function generateMarkdownReport(result: AnalysisResult): string;
export declare function writeReports(result: AnalysisResult, config: ReportConfig): Promise<{
    jsonPath?: string;
    markdownPath?: string;
}>;
