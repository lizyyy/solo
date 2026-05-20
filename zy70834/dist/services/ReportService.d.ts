import { ReconciliationResult, SummaryStatistics, ExportReport } from '../types';
export declare class ReportService {
    generateSummary(results: ReconciliationResult[]): SummaryStatistics;
    private countDiscrepanciesByType;
    generateExportReport(results: ReconciliationResult[], generatedBy: string): ExportReport;
    exportToJSON(report: ExportReport, filePath: string): void;
    exportToCSV(results: ReconciliationResult[], filePath: string): void;
    generateTextReport(report: ExportReport): string;
    private formatResultDetail;
    private formatHealthCheck;
    private formatMedication;
    private translateStatus;
    private translateSeverity;
    exportTextReport(report: ExportReport, filePath: string): void;
}
