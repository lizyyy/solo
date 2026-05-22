interface FixOptions {
    record?: string;
    error?: string;
    field?: string;
    value?: string;
    operator?: string;
    reason?: string;
    withdraw?: string;
    freeze?: string;
    unfreeze?: string;
}
export declare function fixCommand(workDir: string, options: FixOptions): Promise<void>;
export {};
