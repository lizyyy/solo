interface CheckOptions {
    operator?: string;
}
export declare function checkCommand(batchId: string, options: CheckOptions): Promise<number>;
export declare function failuresCommand(batchId: string): Promise<number>;
export {};
