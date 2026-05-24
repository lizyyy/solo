export declare enum SamplingDecision {
    RECORD_AND_SAMPLE = "RECORD_AND_SAMPLE",
    RECORD_ONLY = "RECORD_ONLY",
    DROP = "DROP",
    NOT_APPLICABLE = "NOT_APPLICABLE"
}
export interface AttributeFilter {
    key: string;
    value?: string | number | boolean;
    pattern?: string;
}
export interface SamplingRule {
    name: string;
    description?: string;
    priority: number;
    serviceName?: string;
    serviceNamePattern?: string;
    attributes?: AttributeFilter[];
    samplingRatio: number;
    perSecondLimit?: number;
    decision: SamplingDecision;
}
export interface SamplingConfig {
    version: string;
    defaultSamplingRatio: number;
    defaultDecision: SamplingDecision;
    rules: SamplingRule[];
    globalPerSecondLimit?: number;
    caseSensitive?: boolean;
    strictAttributeMatch?: boolean;
}
export interface Span {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    serviceName: string;
    startTime: number;
    endTime?: number;
    attributes: Record<string, string | number | boolean>;
    status?: {
        code: number;
        message?: string;
    };
}
export interface Trace {
    traceId: string;
    spans: Span[];
    rootSpan?: Span;
    serviceNames: string[];
    startTime: number;
    duration?: number;
}
export interface RuleMatchDetail {
    ruleName: string;
    rulePriority: number;
    matched: boolean;
    matchReasons: string[];
    mismatchReasons: string[];
    serviceNameMatch?: boolean;
    attributeMatches: Array<{
        key: string;
        expected?: string | number | boolean;
        actual?: string | number | boolean;
        matched: boolean;
        caseAdjusted?: boolean;
    }>;
}
export interface SamplingResult {
    traceId: string;
    finalDecision: SamplingDecision;
    matchedRule?: SamplingRule;
    effectiveSamplingRatio: number;
    randomNumber?: number;
    ruleEvaluations: RuleMatchDetail[];
    droppedDueToBudget: boolean;
    budgetExhausted: boolean;
    missingFields: string[];
    caseAdjustments: Array<{
        field: string;
        original: string;
        adjusted: string;
    }>;
    timing: {
        evaluationStart: number;
        evaluationEnd: number;
        totalDurationMs: number;
    };
}
export interface BudgetStats {
    globalBudget?: {
        limitPerSecond: number;
        allocated: number;
        used: number;
        remaining: number;
        exhausted: boolean;
    };
    ruleBudgets: Record<string, {
        limitPerSecond: number;
        used: number;
        remaining: number;
        exhausted: boolean;
    }>;
    totalTracesEvaluated: number;
    totalTracesSampled: number;
    totalTracesDropped: number;
    effectiveSamplingRate: number;
}
export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}
export interface DiagnosticReport {
    metadata: {
        generatedAt: string;
        toolVersion: string;
        inputConfig: {
            configFile?: string;
            traceFile?: string;
            serviceName?: string;
            budgetThreshold?: number;
            outputDir: string;
        };
    };
    configValidation: {
        valid: boolean;
        errors: ValidationError[];
        warnings: ValidationError[];
    };
    traceAnalysis: {
        totalTraces: number;
        totalSpans: number;
        uniqueServices: string[];
        missingFields: string[];
        fieldCaseIssues: Array<{
            field: string;
            occurrences: number;
            examples: string[];
        }>;
    };
    samplingResults: {
        summary: {
            totalEvaluated: number;
            sampled: number;
            dropped: number;
            recordOnly: number;
            sampledPercentage: number;
            droppedPercentage: number;
        };
        byService: Record<string, {
            total: number;
            sampled: number;
            dropped: number;
            sampledPercentage: number;
        }>;
        byRule: Record<string, {
            matched: number;
            sampled: number;
            dropped: number;
            budgetExhausted: number;
        }>;
        details: SamplingResult[];
    };
    budgetAnalysis: BudgetStats;
    conclusions: {
        rootCauses: Array<{
            type: 'rule_mismatch' | 'budget_exhausted' | 'missing_fields' | 'case_mismatch' | 'sampling_ratio';
            description: string;
            severity: 'high' | 'medium' | 'low';
            affectedTraces: number;
            recommendation: string;
        }>;
        recommendations: string[];
    };
}
export interface CLIOptions {
    config: string;
    traces: string;
    service?: string;
    budget?: number;
    output: string;
    format: 'json' | 'markdown' | 'both';
    verbose: boolean;
    quiet: boolean;
    seed?: number;
    deterministic: boolean;
}
export declare enum ExitCode {
    SUCCESS = 0,
    VALIDATION_ERROR = 1,
    INPUT_ERROR = 2,
    PROCESSING_ERROR = 3,
    BUDGET_EXCEEDED = 4,
    TRACES_DROPPED = 5
}
