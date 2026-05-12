interface ReportOptions {
    dataDir: string;
    output?: string;
    operator: string;
}
export declare function executeReport(options: ReportOptions): Promise<void>;
export {};
