import { ReportData } from '../types';
export declare function exportToCSV(batchId: string, outputPath: string): void;
export declare function exportToExcel(batchId: string, outputPath: string): void;
export declare function exportReportToText(report: ReportData, outputPath: string): void;
export declare function exportFailuresToCSV(batchId: string, outputPath: string): void;
export declare function exportAuditLogs(batchId: string, outputPath: string): void;
