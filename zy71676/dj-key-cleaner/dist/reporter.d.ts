import type { CleaningSession, CleaningStats } from './models.js';
export interface ReportSection {
    title: string;
    content: string;
}
export interface FullReport {
    header: string;
    sections: ReportSection[];
    footer: string;
    summary: CleaningStats;
}
export declare function generateReport(session: CleaningSession): FullReport;
export declare function formatReportText(report: FullReport): string;
