import { RequestGroup, Issue, AnalysisOptions } from '../models';
export declare class DuplicateQueryDetector {
    private options;
    constructor(options?: AnalysisOptions);
    detect(requestGroup: RequestGroup): Issue[];
    private findDuplicateQueries;
    private createDuplicateQueryIssue;
    private generateCodeExample;
}
export declare function detectDuplicateQueries(requestGroup: RequestGroup, options?: AnalysisOptions): Issue[];
//# sourceMappingURL=duplicate-query-detector.d.ts.map