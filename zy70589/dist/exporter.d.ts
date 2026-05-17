import { ReportData, BaselineEntry } from './types.js';
export declare function exportJsonReport(reportData: ReportData, outputPath: string): Promise<void>;
export declare function exportBaseline(baseline: BaselineEntry[], outputPath: string): Promise<void>;
export declare function exportHtmlReport(reportData: ReportData, outputPath: string): Promise<void>;
