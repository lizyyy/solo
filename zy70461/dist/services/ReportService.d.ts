import { ProcessReport } from '../models/types';
export declare class ReportService {
    static generateBatchReport(batchId: string, processedBy: string): Promise<ProcessReport>;
    static getReportById(id: string): ProcessReport | null;
    static getReportsByBatchId(batchId: string): ProcessReport[];
    static getAllReports(): ProcessReport[];
    static formatReport(report: ProcessReport): string;
    private static generateNextSuggestions;
}
