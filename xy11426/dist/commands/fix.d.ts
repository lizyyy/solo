interface FixOptions {
    auto?: boolean;
    record?: string;
    field?: string;
    value?: string;
    reason?: string;
    operator?: string;
}
export declare function fixCommand(batchId: string, options: FixOptions): Promise<number>;
export declare function fixedCommand(batchId: string): Promise<number>;
export {};
