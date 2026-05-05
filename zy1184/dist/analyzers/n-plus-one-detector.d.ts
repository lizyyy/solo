import { RequestGroup, Issue, AnalysisOptions } from '../models';
export declare class NPlusOneDetector {
    private options;
    constructor(options?: AnalysisOptions);
    detect(requestGroup: RequestGroup): Issue[];
    private detectNPlusOnePattern;
    private findNPlusOnePatterns;
    private generatePatternKey;
    private isIdLookupQuery;
    private createNPlusOneIssue;
    private generateCodeExample;
}
export declare function detectNPlusOne(requestGroup: RequestGroup, options?: AnalysisOptions): Issue[];
//# sourceMappingURL=n-plus-one-detector.d.ts.map