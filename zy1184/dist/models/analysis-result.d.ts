import { SqlQuery } from './sql-query';
import { RequestGroup } from './request-group';
export type IssueType = 'N_PLUS_1' | 'DUPLICATE_QUERY' | 'DEEP_PAGINATION' | 'MISSING_PRELOAD' | 'UNUSED_FIELDS' | 'LARGE_RESULT_SET' | 'MISSING_INDEX' | 'SLOW_QUERY';
export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface Issue {
    id: string;
    type: IssueType;
    severity: IssueSeverity;
    title: string;
    description: string;
    requestId: string;
    queries: SqlQuery[];
    location?: {
        file?: string;
        line?: number;
        method?: string;
    };
    suggestion: Suggestion;
    impact: Impact;
    evidence: Evidence;
}
export interface Suggestion {
    title: string;
    description: string;
    codeExample?: string;
    expectedImprovement: {
        queryCountReduction?: number;
        durationReductionPercent?: number;
        dataTransferReductionPercent?: number;
    };
}
export interface Impact {
    queryCountIncrease: number;
    durationIncreaseMs: number;
    dataTransferIncreaseBytes: number;
}
export interface Evidence {
    queries: string[];
    parameters?: any[];
    executionOrder?: number[];
}
export interface AnalysisResult {
    requestId: string;
    requestGroup: RequestGroup;
    issues: Issue[];
    summary: AnalysisSummary;
    analysisTime: Date;
}
export interface AnalysisSummary {
    totalRequests: number;
    totalQueries: number;
    totalIssues: number;
    issuesByType: Record<IssueType, number>;
    issuesBySeverity: Record<IssueSeverity, number>;
    topIssues: Issue[];
    totalPotentialImprovement: {
        queryCountReduction: number;
        durationReductionMs: number;
        dataTransferReductionBytes: number;
    };
}
export interface AnalysisOptions {
    checkNPlus1?: boolean;
    checkDuplicateQueries?: boolean;
    checkDeepPagination?: boolean;
    checkMissingPreload?: boolean;
    checkUnusedFields?: boolean;
    checkLargeResultSets?: boolean;
    checkMissingIndexes?: boolean;
    slowQueryThresholdMs?: number;
    deepPaginationThreshold?: number;
    duplicateQueryTimeWindowMs?: number;
    nPlus1Threshold?: number;
}
export declare const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions;
//# sourceMappingURL=analysis-result.d.ts.map