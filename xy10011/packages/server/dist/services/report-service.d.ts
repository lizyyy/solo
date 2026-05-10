import { ReportOptions } from '../types';
declare class ReportService {
    generateReport(options: ReportOptions): Promise<Buffer>;
    private generateExcelReport;
    private generatePDFReport;
    private generateMarkdownReport;
    private collectReportData;
    private addSummarySheet;
    private addBillsSheet;
    private addAuditSheet;
    private calculateTotal;
    private formatDate;
}
export declare const reportService: ReportService;
export {};
