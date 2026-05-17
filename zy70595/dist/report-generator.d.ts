import { DiagnosticReport } from './types';
export declare class ReportGenerator {
    generateTerminalReport(report: DiagnosticReport): string;
    private generateEnvironmentSummary;
    private generateSummary;
    private generateDirtyLinesTable;
    private generateConflictsTable;
    private generateResolutionsSummary;
    generateMachineReadableReport(report: DiagnosticReport, outputPath: string): void;
    generateHumanReadableReport(report: DiagnosticReport, outputPath: string): void;
    private generateMarkdownReport;
    getExitCode(report: DiagnosticReport): number;
}
