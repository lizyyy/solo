import { DiffResult } from './types';
export declare class Reporter {
    generateConsoleSummary(result: DiffResult): void;
    generateJsonReport(result: DiffResult, outputPath: string): void;
    generateMarkdownReport(result: DiffResult, outputPath: string): void;
    private ensureDir;
}
