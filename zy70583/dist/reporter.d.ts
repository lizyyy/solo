import { DenoiseResult } from './types';
export declare class Reporter {
    private result;
    constructor(result: DenoiseResult);
    generateTerminalSummary(): string;
    generateJsonReport(pretty?: boolean): string;
    generateMarkdownReport(): string;
    saveJsonReport(outputPath: string): void;
    saveMarkdownReport(outputPath: string): void;
    saveAllReports(outputDir: string): void;
    private ensureDir;
}
