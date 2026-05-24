interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    details?: any;
}
export declare class SelfCheck {
    private parser;
    private reportGenerator;
    private outputHandler;
    private outputDir;
    constructor(outputDir: string);
    private ensureOutputDir;
    runAllTests(): Promise<TestResult[]>;
    private testSmtpCodeClassification;
    private testEnhancedCodeClassification;
    private testProviderPatterns;
    private testMailboxNotExist;
    private testPolicyRejection;
    private testContentBlocked;
    private testTemporaryFailure;
    private testUnknownCategory;
    private testRetrySuggestions;
    private testBatchAggregation;
    private testReportGeneration;
    private testMultipleBouncesSameRecipient;
    private testOutputFormats;
    private testEdgeCases;
    private testChineseContent;
    private testConfidenceLevels;
}
export {};
