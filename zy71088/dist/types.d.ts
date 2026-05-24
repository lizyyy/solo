export type ExperimentStatus = 'active' | 'completed' | 'archived' | 'unknown';
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'java' | 'kotlin' | 'swift' | 'rust' | 'other';
export interface FlagDefinition {
    name: string;
    description?: string;
    defaultValue: boolean;
    status: ExperimentStatus;
    owner?: string;
    createdAt?: string;
    completedAt?: string;
    dynamicPattern?: string;
    notes?: string;
}
export interface FlagMatch {
    flagName: string;
    matchedFlagName: string;
    filePath: string;
    lineNumber: number;
    column: number;
    matchType: 'direct' | 'dynamic' | 'negated' | 'default_value';
    context: string;
    isNegated: boolean;
    defaultValue?: boolean;
    language: ProgrammingLanguage;
}
export interface FlagAnalysis {
    flag: FlagDefinition;
    matches: FlagMatch[];
    totalOccurrences: number;
    fileCount: number;
    canRemove: boolean;
    riskLevel: RiskLevel;
    riskReasons: string[];
    recommendation: string;
    defaultValueInverted: boolean;
    dynamicNameUsed: boolean;
}
export interface ScanOptions {
    sourceDir: string;
    flagDefinitions: FlagDefinition[];
    outputDir: string;
    excludePatterns: string[];
    includePatterns: string[];
    languages: ProgrammingLanguage[];
    defaultAssumedValue?: boolean;
}
export interface AnalysisResult {
    summary: {
        totalFlags: number;
        flagsScanned: number;
        flagsCanRemove: number;
        flagsWithRisk: number;
        totalMatches: number;
        filesScanned: number;
        scanDuration: number;
    };
    flags: FlagAnalysis[];
    files: {
        path: string;
        language: ProgrammingLanguage;
        matchCount: number;
    }[];
    errors: string[];
    metadata: {
        scanDate: string;
        version: string;
        options: ScanOptions;
    };
}
export interface ReportConfig {
    terminal: boolean;
    json: boolean;
    markdown: boolean;
    outputDir: string;
    baseName: string;
}
export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}
export interface SelfCheckResult {
    name: string;
    passed: boolean;
    message: string;
    details?: Record<string, unknown>;
}
export interface CliOptions {
    flags: string;
    source: string;
    output: string;
    exclude?: string;
    include?: string;
    languages?: string;
    default?: boolean;
    format: string;
    quiet: boolean;
    verbose: boolean;
}
