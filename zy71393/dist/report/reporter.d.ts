import { RegressionReport } from '../types';
export declare class ReportGenerator {
    static generateTerminalSummary(report: RegressionReport): string;
    private static formatIssueTerminal;
    private static calcPercent;
    static generateJson(report: RegressionReport): string;
    static generateMarkdown(report: RegressionReport): string;
    static generateHtml(report: RegressionReport): string;
    static generateExcel(report: RegressionReport, filePath: string): Promise<void>;
    static writeToFile(content: string, filePath: string): void;
}
