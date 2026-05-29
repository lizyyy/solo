import { DriftReport, ExportOptions } from './types';
export declare class ReportExporter {
    export(report: DriftReport, options: ExportOptions): string;
    private exportJson;
    private prepareExportData;
    private maskValue;
    private exportMarkdown;
    private formatDiffMarkdown;
    private groupBySeverity;
    private groupByEnvironment;
    private groupByType;
    private getSeverityLabel;
    private getSeverityEmoji;
    private getPriorityLabel;
}
export declare const reportExporter: ReportExporter;
