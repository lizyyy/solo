import { DriftReport, NullabilityDiff, AffectedQuery, FailurePath } from './types';
export declare function generateReport(changes: NullabilityDiff[], affectedQueries: AffectedQuery[], failurePaths: FailurePath[], options: {
    oldSchemaHash: string;
    newSchemaHash: string;
    clientVersion?: string;
    queriesScanned: number;
    fieldsScanned: number;
}): DriftReport;
export declare function printTerminalReport(report: DriftReport, verbose?: boolean): void;
export declare function writeJsonReport(report: DriftReport, outputDir: string): string;
export declare function writeMarkdownReport(report: DriftReport, outputDir: string): string;
