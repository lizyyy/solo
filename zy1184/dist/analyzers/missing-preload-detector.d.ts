import { RequestGroup, Issue, AnalysisOptions, RepositoryMethodsConfig } from '../models';
export declare class MissingPreloadDetector {
    private options;
    private repositoryMethods?;
    constructor(options?: AnalysisOptions, repositoryMethods?: RepositoryMethodsConfig);
    detect(requestGroup: RequestGroup): Issue[];
    private findPotentialMissingPreloads;
    private isRelatedByForeignKey;
    private analyzePreloadPattern;
    private areQueriesInterleaved;
    private findForeignKeyColumn;
    private createMissingPreloadIssue;
    private generateCodeExample;
    private toPascalCase;
}
export declare function detectMissingPreload(requestGroup: RequestGroup, options?: AnalysisOptions, repositoryMethods?: RepositoryMethodsConfig): Issue[];
//# sourceMappingURL=missing-preload-detector.d.ts.map