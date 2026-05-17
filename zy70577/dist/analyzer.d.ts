import { LogEntry, AnalysisResult, BadLine, CLIOptions } from './types';
interface AnalyzerInput {
    entries: LogEntry[];
    badLines: BadLine[];
    totalLines: number;
    options: CLIOptions;
}
export declare class CacheAnalyzer {
    analyze(input: AnalyzerInput): AnalysisResult;
    private calculateTimeAttribution;
    private estimateCacheMissOverhead;
    private calculateSummary;
    private generateRecommendations;
}
export declare function analyzeCacheData(input: AnalyzerInput): AnalysisResult;
export {};
