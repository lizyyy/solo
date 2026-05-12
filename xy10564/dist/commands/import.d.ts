interface ImportOptions {
    dataDir: string;
    type: 'employee' | 'salary' | 'employment' | 'city-rule' | 'historical';
    file: string;
    operator: string;
}
export declare function executeImport(options: ImportOptions): Promise<void>;
export {};
