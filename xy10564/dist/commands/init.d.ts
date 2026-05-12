interface InitOptions {
    dataDir: string;
    name: string;
    year: number;
    month: number;
    withSample: boolean;
    operator: string;
}
export declare function executeInit(options: InitOptions): Promise<void>;
export {};
