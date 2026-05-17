import { AuditResult } from './types';
export declare class ReportGenerator {
    generateConsoleSummary(auditResult: AuditResult): Promise<void>;
    private printUrlResult;
    private printParseError;
    exportJson(auditResult: AuditResult, outputPath: string): Promise<void>;
    exportHtml(auditResult: AuditResult, outputPath: string): Promise<void>;
    private generateHtmlReport;
    private getStatusClass;
}
