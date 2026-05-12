interface CheckOptions {
    dataDir: string;
    operator: string;
}
export declare function executeCheck(options: CheckOptions): Promise<void>;
export {};
