import { DriftReport } from './types';
export declare class ReportGenerator {
    generateJsonReport(report: DriftReport, outputPath: string): Promise<void>;
    generateMarkdownReport(report: DriftReport, outputPath: string): Promise<void>;
    private generateMarkdownContent;
    printConsoleSummary(report: DriftReport): void;
    private getSeverityColor;
}
