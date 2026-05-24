export interface HTTPRequest {
    method: string;
    uri: string;
    url?: string;
    path?: string;
    headers: Record<string, string | string[]>;
    body?: string | Record<string, any>;
    query?: Record<string, string | string[]>;
}
export interface HTTPResponse {
    status: {
        code: number;
        message?: string;
    };
    headers: Record<string, string | string[]>;
    body?: string | Record<string, any>;
}
export interface CassetteInteraction {
    id: string;
    request: HTTPRequest;
    response: HTTPResponse;
    recordedAt?: string;
    duration?: number;
    sourceLine?: number;
    sourceFile?: string;
}
export interface Cassette {
    version?: string;
    interactions: CassetteInteraction[];
    rawContent: string;
    filePath: string;
    format: 'yaml' | 'json';
}
export interface MaskingRule {
    field: string;
    pattern?: string;
    replacement?: string;
    type: 'body' | 'header' | 'query' | 'url';
}
export interface DiffConfig {
    ignoreOrder: boolean;
    ignoreFields: string[];
    maskingRules: MaskingRule[];
    normalizeHeaders: boolean;
    normalizeJsonKeys: boolean;
    tolerance: number;
}
export type DiffType = 'request_missing' | 'request_added' | 'request_method' | 'request_url' | 'request_header' | 'request_body' | 'request_query' | 'response_status' | 'response_header' | 'response_body' | 'masking_mismatch' | 'unmatched';
export interface DiffDetail {
    path: string;
    expected: any;
    actual: any;
    type: 'added' | 'removed' | 'changed';
}
export interface InteractionDiff {
    interactionId: string;
    type: DiffType;
    severity: 'error' | 'warning' | 'info';
    message: string;
    details: DiffDetail[];
    expectedSource?: {
        file: string;
        line?: number;
    };
    actualSource?: {
        file: string;
        line?: number;
    };
}
export interface DiffResult {
    summary: {
        totalInteractions: {
            expected: number;
            actual: number;
        };
        matched: number;
        added: number;
        removed: number;
        changed: number;
        errors: number;
        warnings: number;
    };
    differences: InteractionDiff[];
    config: DiffConfig;
    generatedAt: string;
    exitCode: number;
}
export interface CLIOptions {
    expected: string;
    actual: string;
    output?: string;
    config?: string;
    ignoreOrder?: boolean;
    ignoreFields?: string[];
    format?: 'text' | 'json' | 'markdown' | 'all';
    verbose?: boolean;
    quiet?: boolean;
}
export declare const ExitCodes: {
    readonly SUCCESS: 0;
    readonly DIFFERENCES_FOUND: 1;
    readonly INPUT_ERROR: 2;
    readonly PARSE_ERROR: 3;
    readonly CONFIG_ERROR: 4;
    readonly INTERNAL_ERROR: 5;
};
export type ExitCode = typeof ExitCodes[keyof typeof ExitCodes];
export interface ExitCodeExplanation {
    code: number;
    name: string;
    description: string;
    action: string;
}
export declare const ExitCodeExplanations: ExitCodeExplanation[];
