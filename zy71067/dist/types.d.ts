export type RiskLevel = 'critical' | 'warning' | 'info' | 'safe';
export interface LocaleEntry {
    key: string;
    value: string;
    locale: string;
    pluralForm?: string;
    originalValue?: string;
}
export interface WidthCalculationResult {
    text: string;
    charWidth: number;
    charCount: number;
    widthDetails: Array<{
        char: string;
        width: number;
        codePoint: number;
    }>;
}
export interface PlaceholderIssue {
    type: 'missing' | 'extra' | 'mismatch';
    placeholder: string;
    description: string;
}
export interface CheckConfig {
    keyPattern?: string;
    locale: string;
    interfacePosition: string;
    maxWidth: number;
    maxChars?: number;
    placeholders?: string[];
    pluralRules?: string[];
}
export interface CheckResult {
    key: string;
    locale: string;
    interfacePosition: string;
    originalText: string;
    checkedText: string;
    pluralForm?: string;
    widthResult: WidthCalculationResult;
    maxWidth: number;
    widthOverflow: number;
    placeholderIssues: PlaceholderIssue[];
    riskLevel: RiskLevel;
    riskExplanation: string;
}
export interface ReportSummary {
    totalChecks: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    safeCount: number;
    overflowCount: number;
    placeholderIssueCount: number;
    checkedAt: string;
    configHash: string;
}
export interface FullReport {
    summary: ReportSummary;
    results: CheckResult[];
    config: {
        inputFiles: string[];
        outputDir: string;
        checkConfigs: CheckConfig[];
        timestamp: string;
    };
}
export interface CLIOptions {
    input: string[];
    output: string;
    config?: string;
    locale?: string;
    position?: string;
    maxWidth?: number;
    maxChars?: number;
    placeholders?: string;
    format: string[];
    overwrite: boolean;
    append: boolean;
    verbose: boolean;
    quiet: boolean;
}
export interface ConfigFile {
    checks: Array<{
        keyPattern?: string;
        locale: string;
        interfacePosition: string;
        maxWidth: number;
        maxChars?: number;
        placeholders?: string[];
    }>;
    output?: {
        dir?: string;
        formats?: string[];
    };
    defaults?: {
        maxWidth?: number;
        placeholders?: string[];
    };
}
