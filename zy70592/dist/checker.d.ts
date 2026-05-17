import { ErrorResponseInfo, StatusCodeGroup, CheckResult } from './types';
export declare class ConsistencyChecker {
    private errorResponses;
    private inputFile;
    private totalEndpoints;
    constructor(errorResponses: ErrorResponseInfo[], inputFile: string, totalEndpoints: number);
    private getStatusCodeCategory;
    groupByStatusCode(): StatusCodeGroup[];
    private checkMissingSchema;
    private checkFieldConsistency;
    private checkCrossStatusCodeConsistency;
    private generateRecommendations;
    check(): CheckResult;
}
