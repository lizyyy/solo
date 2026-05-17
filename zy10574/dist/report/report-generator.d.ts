import { MatrixReport, VersionMatrix, CLIOptions } from '../types.js';
export declare function buildReport(matrix: VersionMatrix, rootPath: string, scanTime: string): MatrixReport;
export declare function printTerminalReport(report: MatrixReport): void;
export declare function writeJsonReport(report: MatrixReport, outputPath: string): Promise<void>;
export declare function writeMarkdownReport(report: MatrixReport, outputPath: string): Promise<void>;
export declare function generateReports(report: MatrixReport, options: CLIOptions): Promise<void>;
