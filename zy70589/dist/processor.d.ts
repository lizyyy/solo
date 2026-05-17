import { GitleaksFinding, BaselineEntry, ReportData } from './types.js';
export declare function processFindings(findings: GitleaksFinding[], baseline: BaselineEntry[] | undefined, parseErrors: any[] | undefined, scanReportPath: string, baselinePath?: string): ReportData;
export declare function generateNewBaseline(reportData: ReportData): BaselineEntry[];
