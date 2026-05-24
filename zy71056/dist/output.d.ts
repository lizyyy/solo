import { LicenseReport } from './types';
export declare function printTerminalSummary(report: LicenseReport): void;
export declare function writeJsonReport(report: LicenseReport, outputDir: string): string;
export declare function writeMarkdownReport(report: LicenseReport, outputDir: string): string;
