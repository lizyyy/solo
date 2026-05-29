export type EnvironmentName = 'development' | 'testing' | 'staging' | 'production' | string;
export type ConfigFormat = 'json' | 'yaml' | 'yml' | 'env';
export type DiffSeverity = 'critical' | 'warning' | 'info' | 'false_positive';
export type DiffType = 'value_mismatch' | 'missing_key' | 'extra_key' | 'type_mismatch' | 'array_order_mismatch' | 'plaintext_secret' | 'default_value_changed' | 'placeholder_mismatch';
export interface ConfigFile {
    path: string;
    format: ConfigFormat;
    environment: EnvironmentName;
    content: Record<string, unknown>;
    importedAt: string;
    checksum: string;
}
export interface SecretPlaceholder {
    pattern: RegExp;
    placeholder: string;
    description: string;
}
export interface DefaultValue {
    key: string;
    value: unknown;
    description: string;
    mutable: boolean;
}
export interface ChangeRecord {
    id: string;
    timestamp: string;
    environment: EnvironmentName;
    key: string;
    oldValue: unknown;
    newValue: unknown;
    author?: string;
    reason?: string;
    ticketId?: string;
}
export interface DiffDetail {
    key: string;
    type: DiffType;
    severity: DiffSeverity;
    environment: EnvironmentName;
    baselineValue: unknown;
    targetValue: unknown;
    explanation: string;
    requiresManualReview: boolean;
    suggestedAction?: string;
    relatedChangeId?: string;
    falsePositiveReason?: string;
}
export interface DriftReport {
    id: string;
    generatedAt: string;
    baselineEnvironment: EnvironmentName;
    targetEnvironments: EnvironmentName[];
    totalDiffs: number;
    criticalDiffs: number;
    warningDiffs: number;
    infoDiffs: number;
    falsePositives: number;
    requiresManualReview: number;
    diffs: DiffDetail[];
    maskedContent: Record<string, unknown>;
}
export interface ImportResult {
    success: boolean;
    importedFiles: string[];
    errors: string[];
    warnings: string[];
    detectedSecrets: string[];
}
export interface QueryOptions {
    environment?: EnvironmentName;
    severity?: DiffSeverity;
    keyPattern?: string;
    requiresReview?: boolean;
    includeResolved?: boolean;
}
export interface ExportOptions {
    format: 'json' | 'markdown';
    outputPath: string;
    includeMaskedValues?: boolean;
    includeSuggestions?: boolean;
}
