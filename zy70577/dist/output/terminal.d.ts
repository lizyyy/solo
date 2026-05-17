import { AnalysisResult } from '../types';
export declare class TerminalOutput {
    printSummary(result: AnalysisResult): void;
    private printHeader;
    private printSubHeader;
    private formatHitRate;
    private formatDuration;
    private printStageTable;
    private printBadLines;
}
export declare function printTerminalSummary(result: AnalysisResult): void;
