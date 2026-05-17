import { ScanResult } from '../types';
export declare class Reporter {
    generateConsoleSummary(result: ScanResult): void;
    private printScanInfo;
    private printFlagsSummary;
    private printReferencesSummary;
    private printDeadBranchesSummary;
    private printBadSamplesSummary;
    private getBranchTypeName;
    generateJsonReport(result: ScanResult, outputPath: string): Promise<void>;
    generateMarkdownReport(result: ScanResult, outputPath: string): Promise<void>;
    private buildMarkdownContent;
    generateHtmlReport(result: ScanResult, outputPath: string): Promise<void>;
    private buildHtmlContent;
    private renderDeadBranchesHtml;
    private renderBadSamplesHtml;
}
