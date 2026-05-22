import { BillingRecord } from '../types';
export declare class ReportService {
    generateExcelReport(periodStart: Date, periodEnd: Date, includeDetails?: boolean): Promise<Buffer>;
    private populateSummarySheet;
    private populateRecordsSheet;
    private populateAnomaliesSheet;
    private populateCalculationsSheet;
    generatePDFReport(periodStart: Date, periodEnd: Date, includeDetails?: boolean): Promise<Buffer>;
    generateRecordDetailsHTML(record: BillingRecord): string;
    private getStatusText;
    private getAnomalyTypeText;
    private getSeverityText;
    private getActionText;
}
export declare const reportService: ReportService;
