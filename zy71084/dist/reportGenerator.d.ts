import { CheckReport, OutputFormats } from './types';
export declare class ReportGenerator {
    static generateReport(report: CheckReport, outputDir: string, formats: OutputFormats): void;
    static printTerminalSummary(report: CheckReport): void;
    private static printSummaryStats;
    private static printProfileResults;
    private static printCertificateResults;
    private static printTargetResults;
    private static printAllIssues;
    private static printFinalResult;
    private static getStatusIcon;
    private static getStatusColor;
    static writeJsonReport(report: CheckReport, filePath: string): void;
    static writeMarkdownReport(report: CheckReport, filePath: string): void;
    private static generateMarkdownContent;
    private static getMarkdownStatusBadge;
}
