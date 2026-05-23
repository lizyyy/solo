interface HistoryOptions {
    batch?: string;
    record?: string;
    operator?: string;
    limit?: number;
}
export declare function historyCommand(options: HistoryOptions): Promise<number>;
export {};
