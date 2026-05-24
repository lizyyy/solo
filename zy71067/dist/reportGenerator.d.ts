import { CheckResult, ReportSummary } from './types';
export interface GenerateReportOptions {
    outputDir: string;
    formats: string[];
    overwrite: boolean;
    append: boolean;
    inputFiles: string[];
    checkConfigs: any[];
}
export declare function generateReports(results: CheckResult[], options: GenerateReportOptions): {
    summary: ReportSummary;
    files: string[];
};
export declare function getExitCode(summary: ReportSummary): number;
