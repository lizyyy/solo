import type { CorrectionReport } from '../types';
export declare class ReportService {
    generateReport(correctionId: string, generatedBy: string): Promise<CorrectionReport>;
    exportToMarkdown(report: CorrectionReport): Promise<string>;
    exportToCSV(report: CorrectionReport): Promise<string>;
    getReport(id: string): Promise<CorrectionReport | undefined>;
    getReportsByCorrection(correctionId: string): Promise<CorrectionReport[]>;
    private formatDate;
    private formatCurrency;
    private generateAssetRemarks;
    private generateAuditTrailFromCorrection;
    private summarizeTagChanges;
}
export declare const reportService: ReportService;
