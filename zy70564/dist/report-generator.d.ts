import { PreviewReport, FilePreviewResult } from './types';
export declare class ReportGenerator {
    generateTerminalSummary(report: PreviewReport): string;
    generateMachineReadable(report: PreviewReport): string;
    generateHumanReadable(report: PreviewReport): string;
    generateReport(results: FilePreviewResult[]): PreviewReport;
    getExitCode(report: PreviewReport): number;
}
