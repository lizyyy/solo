export declare class CLIHandler {
    private storage;
    private engine;
    private dataDir;
    constructor(customDataDir?: string);
    private initializeDefaultRules;
    init(force?: boolean): void;
    private createExampleSamples;
    private printInitSummary;
    list(): void;
    import(filePath: string): void;
    check(sampleId: string, showDetails?: boolean): void;
    private printCheckResult;
    private printStatusGuide;
    history(sampleId: string, limit?: number): void;
    export(sampleId: string, formatType?: 'json' | 'csv'): void;
    validateRules(): void;
    validateMaterials(sampleId: string): void;
    getDataDir(): string;
}
