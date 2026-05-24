import { ScanResult } from '../types';
export declare function generateMarkdownReport(result: ScanResult): string;
export declare function writeMarkdownReport(result: ScanResult, outputDir: string): string;
export declare function writeLatestMarkdownReport(result: ScanResult, outputDir: string): string;
