import { DailyReport } from '../types';
export declare function generateDailyReport(date: string): Promise<DailyReport>;
export declare function exportReportToJSON(report: DailyReport, outputDir: string): Promise<string>;
export declare function exportReportToCSV(report: DailyReport, outputDir: string): Promise<string>;
