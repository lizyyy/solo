interface ExportOptions {
    format?: 'csv' | 'xlsx' | 'json';
    output?: string;
    batch?: string;
    frozenOnly?: boolean;
    includeRaw?: boolean;
}
export declare function exportCommand(workDir: string, options: ExportOptions): Promise<void>;
export {};
