import { BaseReporter } from './base-reporter';
export declare class MarkdownReporter extends BaseReporter {
    generate(): string;
    private generateHeader;
    private generateSummary;
    private generateDifferences;
    private groupBySeverity;
    private formatDiff;
    private formatValue;
    private generateExitCodeInfo;
    private generateConfigInfo;
    getFileName(): string;
}
