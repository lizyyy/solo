interface TestResult {
    name: string;
    category: string;
    passed: boolean;
    error?: string;
    duration: number;
    details?: Record<string, unknown>;
}
export declare class SelfChecker {
    private outputDir;
    private quickMode;
    constructor(outputDir: string, quickMode: boolean);
    run(): Promise<TestResult[]>;
    private testBasicSchema;
    private testComplexSchema;
    private testArraySchema;
    private testNestedSchema;
    private testBoundaryConditions;
    private testInvalidSampleGeneration;
    private testReportGeneration;
    private testSeedReproducibility;
    printResults(results: TestResult[]): void;
}
export {};
