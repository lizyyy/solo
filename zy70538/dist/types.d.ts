export declare enum CacheExplanationStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    BLOCKED = "blocked",
    REVOKED = "revoked",
    COMPENSATED = "compensated"
}
export interface CacheRule {
    id: string;
    name: string;
    description: string;
    ttl: number;
    priority: number;
    conditions: CacheRuleCondition[];
    createdAt: Date;
}
export interface CacheRuleCondition {
    field: string;
    operator: string;
    value: string;
}
export interface FailureDetails {
    rawInput: Record<string, unknown>;
    processingBasis: string[];
    finalConclusion: string;
    errorStack?: string;
}
export interface CacheExplanation {
    id: string;
    apiPath: string;
    cacheKey: string;
    cacheKeyCalculation: {
        algorithm: string;
        factors: string[];
        rawValue: string;
    };
    matchedRule: CacheRule;
    generatedAt: Date;
    expiration: {
        expiresAt: Date;
        ttlSeconds: number;
        conditions: string[];
    };
    status: CacheExplanationStatus;
    explanationReport: {
        summary: string;
        details: string[];
        recommendations?: string;
    };
    hitHistory: Array<{
        hitAt: Date;
        requestId: string;
        clientIp?: string;
    }>;
    failureDetails?: FailureDetails;
    metadata: {
        createdBy?: string;
        createdAt: Date;
        updatedAt: Date;
        confirmedBy?: string;
        confirmedAt?: Date;
    };
}
export interface CreateExplanationRequest {
    apiPath: string;
    cacheKey: string;
    cacheKeyCalculation: {
        algorithm: string;
        factors: string[];
        rawValue: string;
    };
    matchedRule: Omit<CacheRule, 'createdAt'>;
    ttlSeconds: number;
    expirationConditions: string[];
    explanationReport: {
        summary: string;
        details: string[];
        recommendations?: string;
    };
    createdBy?: string;
}
export interface QueryExplanationParams {
    apiPath?: string;
    cacheKey?: string;
    status?: CacheExplanationStatus;
    ruleId?: string;
    page?: number;
    pageSize?: number;
}
export interface ManualCorrectionRequest {
    explanationId: string;
    newStatus: CacheExplanationStatus;
    reason: string;
    correctedBy: string;
    overrideTtl?: number;
}
export interface ForceRefreshRequest {
    cacheKey: string;
    reason: string;
    refreshedBy: string;
}
