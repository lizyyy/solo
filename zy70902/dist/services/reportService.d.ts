import { ReportData } from '../types';
export declare class ReportService {
    generateReport(batchId: string, resultId: string, generatedBy: string, periodStart?: string, periodEnd?: string): Promise<ReportData>;
    generateExcelReport(reportId: string): Promise<Buffer>;
    generatePdfReport(reportId: string): Promise<Buffer>;
    getReport(reportId: string): ReportData | undefined;
    getAllReports(): ReportData[];
}
export declare const reportService: ReportService;
