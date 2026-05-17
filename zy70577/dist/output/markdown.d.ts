import { AnalysisResult, CLIOptions } from '../types';
export declare class MarkdownOutput {
    write(result: AnalysisResult, options: CLIOptions): string;
    private getOutputPath;
    private ensureOutputDir;
    private generateMarkdown;
    private formatDuration;
}
export declare function writeMarkdownOutput(result: AnalysisResult, options: CLIOptions): string;
