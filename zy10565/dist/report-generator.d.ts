import { ReportData, ReportOptions, HttpRequestRecord, VariableMap } from './types';
export declare class ReportGenerator {
    private replayGenerator;
    constructor();
    generateTerminalReport(data: ReportData): string;
    generateJsonReport(data: ReportData): string;
    generateMarkdownReport(data: ReportData): string;
    writeReports(data: ReportData, options: ReportOptions): Promise<string[]>;
    private getTypeIcon;
    buildReportData(records: HttpRequestRecord[], variables: VariableMap, totalLines: number, validLines: number, badLines: number): ReportData;
}
