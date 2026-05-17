import { ExpandResult } from './types';
export declare class OutputGenerator {
    private result;
    private outputDir;
    constructor(result: ExpandResult, outputDir?: string);
    private ensureOutputDir;
    private getOutputPath;
    writeJson(): string;
    writeMarkdown(): string;
    writeExpandedYaml(): string;
    private getValuePreview;
    private generateMarkdown;
    private formatValue;
    printTerminalSummary(): void;
}
