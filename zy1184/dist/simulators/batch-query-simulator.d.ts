import { RequestGroup, Issue, Optimization, TableStructure, RepositoryMethodsConfig, SimulationOptions } from '../models';
export declare class BatchQuerySimulator {
    private options;
    private tableStructures?;
    private repositoryMethods?;
    constructor(options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig);
    simulate(requestGroup: RequestGroup, issues: Issue[]): Optimization | null;
    private createOptimizedQuery;
    private isBatchableQuery;
    private collectAllParameters;
    private generateBatchQuery;
}
export declare function simulateBatchQuery(requestGroup: RequestGroup, issues: Issue[], options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): Optimization | null;
//# sourceMappingURL=batch-query-simulator.d.ts.map