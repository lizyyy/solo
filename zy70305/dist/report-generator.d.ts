import { ScanResult } from './types';
export declare class ReportGenerator {
    private outputDir;
    constructor(outputDir: string);
    generateMarkdown(result: ScanResult, filename?: string): string;
    generateCsv(result: ScanResult, filename?: string): string;
    private buildMarkdownReport;
    private buildCsvReport;
    private renderDiffs;
    private groupBy;
    private isExemptionMatch;
}
//# sourceMappingURL=report-generator.d.ts.map