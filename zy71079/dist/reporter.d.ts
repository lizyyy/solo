import { ScanReport, CliOptions } from './types';
export declare class Reporter {
    private report;
    private options;
    constructor(report: ScanReport, options: CliOptions);
    printSummary(): void;
    private printIssueBreakdown;
    private printTopIssues;
    private printIssue;
    writeJsonReport(): Promise<string>;
    writeMarkdownReport(): Promise<string>;
    private generateMarkdownReport;
    getExitCode(): number;
}
export declare function createReporter(report: ScanReport, options: CliOptions): Reporter;
//# sourceMappingURL=reporter.d.ts.map