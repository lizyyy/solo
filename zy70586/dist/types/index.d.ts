export interface FeatureFlag {
    name: string;
    defaultValue: boolean;
    description?: string;
    source?: string;
}
export interface CodeReference {
    flagName: string;
    filePath: string;
    lineNumber: number;
    column: number;
    context: string;
    contextType: 'if' | 'else' | 'ternary' | 'function-call' | 'other';
    rawCode: string;
}
export interface DeadBranch {
    flagName: string;
    filePath: string;
    lineNumber: number;
    column: number;
    branchType: 'true-branch' | 'false-branch' | 'entire-condition';
    defaultValue: boolean;
    context: string;
    suggestion: string;
    rawCode: string;
    confidence: 'high' | 'medium' | 'low';
}
export interface BadSample {
    filePath: string;
    lineNumber?: number;
    column?: number;
    reason: string;
    rawContent?: string;
    errorType: 'parse-error' | 'syntax-error' | 'unknown-flag' | 'invalid-default' | 'other';
}
export interface ScanResult {
    flags: {
        total: number;
        analyzed: number;
        withDeadBranches: number;
        list: FeatureFlag[];
    };
    references: {
        total: number;
        byFile: Record<string, number>;
        byFlag: Record<string, number>;
        list: CodeReference[];
    };
    deadBranches: {
        total: number;
        byFile: Record<string, number>;
        byFlag: Record<string, number>;
        list: DeadBranch[];
    };
    badSamples: BadSample[];
    scanInfo: {
        startTime: string;
        endTime: string;
        sourceDir: string;
        filesScanned: number;
        flagsSource: string;
    };
}
export interface ScanOptions {
    sourceDir: string;
    flagsFile?: string;
    flags?: FeatureFlag[];
    outputDir: string;
    filePatterns: string[];
    excludePatterns: string[];
    defaultFlagValue?: boolean;
    generateHtml?: boolean;
    generateMarkdown?: boolean;
}
export interface MergeStrategy {
    fileDefaultPriority: boolean;
    explicitDefaultOverride: boolean;
}
