import { RequestGroup, Issue, AnalysisOptions, TableStructure } from '../models';
export declare class SlowQueryDetector {
    private options;
    private tableStructures?;
    constructor(options?: AnalysisOptions, tableStructures?: TableStructure[]);
    detect(requestGroup: RequestGroup): Issue[];
    private isSlowQuery;
    private createSlowQueryIssue;
    private analyzeSlowQuery;
    private getAllIndexedColumns;
    private generateIndexExample;
    private getDefaultSuggestion;
}
export declare function detectSlowQueries(requestGroup: RequestGroup, options?: AnalysisOptions, tableStructures?: TableStructure[]): Issue[];
//# sourceMappingURL=slow-query-detector.d.ts.map