import { DiffResult } from '../types';
import { BaseReporter } from './base-reporter';
export declare class TerminalReporter extends BaseReporter {
    private verbose;
    constructor(result: DiffResult, outputDir: string, expectedFile: string, actualFile: string, verbose?: boolean);
    generate(): string;
    private generateHeader;
    private generateSummary;
    private generateDifferences;
    private groupBySeverity;
    private formatDiff;
    private generateExitCodeInfo;
}
