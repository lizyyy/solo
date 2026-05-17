import { OpenAPIParser } from './parser';
import { PaginationConfig, CheckResult } from './types';
export declare class PaginationConsistencyChecker {
    private parser;
    private config;
    private canonicalParamName;
    private canonicalFieldName;
    constructor(parser: OpenAPIParser, config?: Partial<PaginationConfig>);
    check(): CheckResult;
    private shouldExcludePath;
    private shouldIncludePath;
    private analyzeEndpoint;
    private extractQueryParams;
    private getSuccessResponseSchema;
    private identifyPaginationParams;
    private identifyResponsePaginationFields;
    private isLikelyPaginationEndpoint;
    private checkParamConsistency;
    private checkResponseConsistency;
}
