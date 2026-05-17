import { ReplayReport } from "./types";
export declare class ReportGenerator {
    private report;
    private outputDir;
    constructor(report: ReplayReport, outputDir: string);
    printTerminalSummary(): void;
    exportJson(): void;
    exportMarkdown(): void;
    exportAll(): void;
}
