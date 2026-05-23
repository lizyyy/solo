interface ExportOptions {
    format?: string;
    failures?: boolean;
    audit?: boolean;
    report?: boolean;
    output?: string;
}
export declare function exportCommand(batchId: string, options: ExportOptions): Promise<number>;
export {};
