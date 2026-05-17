import { CheckReport, CLIOptions } from './types.js';
export declare function printTerminalSummary(report: CheckReport, verbose: boolean): void;
export declare function writeJsonReport(report: CheckReport, outputDir: string): Promise<string>;
export declare function writeMarkdownReport(report: CheckReport, outputDir: string): Promise<string>;
export declare function writeHtmlReport(report: CheckReport, outputDir: string): Promise<string>;
export declare function generateReports(report: CheckReport, options: CLIOptions): Promise<{
    json?: string;
    markdown?: string;
    html?: string;
}>;
