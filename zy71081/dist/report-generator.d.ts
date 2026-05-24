import { DiagnosticReport, SamplingResult, Trace, BudgetStats, CLIOptions } from './types';
export declare class ReportGenerator {
    private options;
    private verbose;
    private quiet;
    constructor(options: CLIOptions);
    generateReport(configValidation: DiagnosticReport['configValidation'], traceAnalysis: DiagnosticReport['traceAnalysis'], samplingResults: SamplingResult[], budgetStats: BudgetStats, traces: Trace[]): DiagnosticReport;
    private analyzeRootCauses;
    printTerminalSummary(report: DiagnosticReport): void;
    writeJsonReport(report: DiagnosticReport): string;
    writeMarkdownReport(report: DiagnosticReport): string;
    private generateMarkdown;
    private ensureOutputDir;
}
