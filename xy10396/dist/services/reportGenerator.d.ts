import { AfterSalesReport } from '../types';
import { DataStore } from './dataStore';
export declare class ReportGenerator {
    private dataStore;
    private abnormalityChecker;
    constructor(dataStore: DataStore);
    generateReport(): AfterSalesReport;
    private generateSummary;
    private generateReportId;
    exportReportToJson(report: AfterSalesReport, outputPath: string): void;
    exportReportToText(report: AfterSalesReport, outputPath: string): void;
    formatReportAsText(report: AfterSalesReport): string;
    private formatStatus;
    private formatCompensationStatus;
    printReport(report: AfterSalesReport): void;
}
