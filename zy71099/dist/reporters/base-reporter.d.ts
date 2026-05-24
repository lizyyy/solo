import { DiffResult, ExitCodeExplanations } from '../types';
export declare abstract class BaseReporter {
    protected result: DiffResult;
    protected outputDir: string;
    protected expectedFile: string;
    protected actualFile: string;
    constructor(result: DiffResult, outputDir: string, expectedFile: string, actualFile: string);
    abstract generate(): string | Promise<string>;
    protected getRelativePath(filePath: string): string;
    protected formatSourceLink(filePath: string, line?: number): string;
    protected getExitCodeExplanation(): typeof ExitCodeExplanations[0];
}
