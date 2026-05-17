import { CheckResult } from './types';
export declare class Reporter {
    private result;
    constructor(result: CheckResult);
    printTerminalSummary(): void;
    private printSummaryStats;
    private printInconsistencySummary;
    private getTypeName;
    private printInconsistencyDetails;
    private printInconsistency;
    private printBadEndpoints;
    exportJSON(outputPath: string): void;
    exportMarkdown(outputPath: string): void;
    private generateMarkdown;
    private formatInconsistencyMarkdown;
    hasErrors(): boolean;
}
