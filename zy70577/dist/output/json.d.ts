import { AnalysisResult, CLIOptions } from '../types';
export declare class JsonOutput {
    write(result: AnalysisResult, options: CLIOptions): string;
    private getOutputPath;
    private ensureOutputDir;
}
export declare function writeJsonOutput(result: AnalysisResult, options: CLIOptions): string;
