import { AuditResult } from '../types.js';
export declare class ReportGenerator {
    private projectDir;
    private outputDir;
    constructor(projectDir: string, outputDir: string);
    generateTerminalSummary(result: AuditResult): void;
    private colorizeNumber;
    private getRiskIcon;
    private printRiskTable;
    generateJsonReport(result: AuditResult): Promise<string>;
    generateMarkdownReport(result: AuditResult): Promise<string>;
    private buildMarkdownContent;
    private getLevelEmoji;
    private formatSize;
    generateAll(result: AuditResult): Promise<{
        json: string;
        markdown: string;
    }>;
}
