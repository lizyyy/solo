export interface ReportOptions {
    dataDir?: string;
    format?: "table" | "json";
}
export declare function runReport(options?: ReportOptions): void;
