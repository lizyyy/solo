import { CheckResult, CliOptions } from './types';
export declare function printTerminalSummary(result: CheckResult, verbose?: boolean): void;
export declare function writeJsonReport(result: CheckResult, outputDir: string): string;
export declare function writeMarkdownReport(result: CheckResult, outputDir: string): string;
export declare function generateReports(result: CheckResult, options: CliOptions): {
    json?: string;
    markdown?: string;
};
