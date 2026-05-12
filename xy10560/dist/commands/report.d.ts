export interface ReportOptions {
    storePath?: string;
    history?: number;
    json?: boolean;
    operator: string;
}
export declare function reportCommand(options: ReportOptions): void;
