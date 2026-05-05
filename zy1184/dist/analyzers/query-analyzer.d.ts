import { RequestGroup, AnalysisResult, AnalysisOptions, TableStructure, RepositoryMethodsConfig } from '../models';
export declare class QueryAnalyzer {
    private options;
    private tableStructures?;
    private repositoryMethods?;
    constructor(options?: AnalysisOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig);
    analyze(requestGroup: RequestGroup): AnalysisResult;
    analyzeBatch(requestGroups: RequestGroup[]): AnalysisResult[];
    private detectLargeResultSets;
    private detectMissingIndexes;
    private getAllIndexedColumns;
    private createSummary;
    static analyzeBatch(requestGroups: RequestGroup[], options?: AnalysisOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): AnalysisResult[];
}
export declare function analyzeQuery(requestGroup: RequestGroup, options?: AnalysisOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): AnalysisResult;
export declare function analyzeQueriesBatch(requestGroups: RequestGroup[], options?: AnalysisOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): AnalysisResult[];
//# sourceMappingURL=query-analyzer.d.ts.map