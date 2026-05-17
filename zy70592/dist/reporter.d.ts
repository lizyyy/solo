import { CheckResult } from './types';
export declare class Reporter {
    private result;
    private outputDir;
    constructor(result: CheckResult, outputDir?: string);
    private ensureOutputDir;
    printConsoleSummary(): void;
    writeJsonOutput(outputPath?: string): string;
    writeMarkdownOutput(outputPath?: string): string;
    private generateMarkdown;
    generateAllReports(jsonPath?: string, markdownPath?: string): void;
}
