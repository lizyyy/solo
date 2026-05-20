import { ReconciliationRecord, ReconciliationSummary } from '../models/types';
declare class ReportService {
    private reportsDir;
    constructor();
    private ensureReportsDirectory;
    generateReconciliationCSV(record: ReconciliationRecord): string;
    generateDetailedCSV(records: ReconciliationRecord[]): string;
    generateReconciliationPDF(record: ReconciliationRecord): string;
    generateSummaryPDF(summary: ReconciliationSummary): string;
    getReportFilePath(fileName: string): string | null;
    private getStatusText;
    private getDiscrepancyTypeText;
    private getSeverityText;
    private getDiscrepancyStatusText;
    private getReviewResultText;
}
export declare const reportService: ReportService;
export {};
