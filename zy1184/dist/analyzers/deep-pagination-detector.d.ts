import { RequestGroup, Issue, AnalysisOptions } from '../models';
export declare class DeepPaginationDetector {
    private options;
    constructor(options?: AnalysisOptions);
    detect(requestGroup: RequestGroup): Issue[];
    private isDeepPaginationQuery;
    private createDeepPaginationIssue;
    private estimatePaginationCost;
    private generateCodeExample;
}
export declare function detectDeepPagination(requestGroup: RequestGroup, options?: AnalysisOptions): Issue[];
//# sourceMappingURL=deep-pagination-detector.d.ts.map