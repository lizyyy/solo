interface ReportOptions {
    batch?: string;
    detail?: boolean;
}
export declare function reportCommand(workDir: string, options: ReportOptions): Promise<void>;
export {};
