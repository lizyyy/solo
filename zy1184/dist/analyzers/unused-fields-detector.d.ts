import { RequestGroup, Issue, AnalysisOptions, TableStructure } from '../models';
export declare class UnusedFieldsDetector {
    private options;
    private tableStructures?;
    constructor(options?: AnalysisOptions, tableStructures?: TableStructure[]);
    detect(requestGroup: RequestGroup): Issue[];
    private hasUnusedFields;
    private isAggregateQuery;
    private createUnusedFieldsIssue;
    private estimateDataWaste;
    private generateCodeExample;
    private toPascalCase;
}
export declare function detectUnusedFields(requestGroup: RequestGroup, options?: AnalysisOptions, tableStructures?: TableStructure[]): Issue[];
//# sourceMappingURL=unused-fields-detector.d.ts.map