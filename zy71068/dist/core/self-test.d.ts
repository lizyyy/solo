export declare class SelfTestRunner {
    private outputDir;
    private verbose;
    private testDataDir;
    private results;
    constructor(outputDir: string, verbose?: boolean);
    runAll(): Promise<boolean>;
    private setupTestData;
    private testFontScanner;
    private testVersionConflict;
    private testCssParser;
    private testRemoteFontDetection;
    private testLicenseMatching;
    private testLicenseExpiry;
    private testRiskAssessment;
    private testFullAudit;
    private testReportGeneration;
}
