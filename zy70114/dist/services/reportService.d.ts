import { Report, ReportPeriod } from '../types';
export declare const generateReport: (period: ReportPeriod) => Report;
export declare const formatReportForDisplay: (report: Report) => string;
