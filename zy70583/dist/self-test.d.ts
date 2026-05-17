export declare class SelfTester {
    private tempDir;
    private passed;
    private failed;
    constructor();
    runAllTests(): Promise<boolean>;
    private testJsonParsing;
    private testCsvParsing;
    private testBadRowHandling;
    private testNoiseScoring;
    private testSilenceMatching;
    private testReportGeneration;
    private testEdgeCases;
    private generateTestAlerts;
    private generateTestRules;
    private generateTestSilences;
    private pass;
    private fail;
    private cleanup;
}
