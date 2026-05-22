interface HistoryOptions {
    limit?: number;
    batch?: string;
}
export declare function historyCommand(workDir: string, options: HistoryOptions): Promise<void>;
export {};
