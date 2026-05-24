import { AnalysisReport, BounceRecord } from '../types';
export declare class OutputHandler {
    private outputDir;
    constructor(outputDir: string);
    private ensureOutputDir;
    printConsoleSummary(records: BounceRecord[], report: AnalysisReport): void;
    writeJsonReport(report: AnalysisReport, filename?: string): string;
    writeMarkdownReport(report: AnalysisReport, records: BounceRecord[], filename?: string): string;
    private generateMarkdownContent;
    writeDetailedJson(records: BounceRecord[], filename?: string): string;
    writeRetryList(records: BounceRecord[], filename?: string): string;
    writeSuppressionList(records: BounceRecord[], filename?: string): string;
}
