import { AnalysisResult, CLIOptions } from '../types';
export declare function generateReports(result: AnalysisResult, options: CLIOptions, outputDir: string): Promise<void>;
export declare function generateBriefSummary(result: AnalysisResult): string;
