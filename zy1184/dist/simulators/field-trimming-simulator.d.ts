import { RequestGroup, Issue, Optimization, TableStructure, RepositoryMethodsConfig, SimulationOptions } from '../models';
export declare class FieldTrimmingSimulator {
    private options;
    private tableStructures?;
    private repositoryMethods?;
    constructor(options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig);
    simulate(requestGroup: RequestGroup, issues: Issue[]): Optimization | null;
    private estimateTotalFields;
    private estimateDataTransfer;
    private createOptimizedQuery;
    private getEssentialFields;
    private hasIdInWhere;
    private buildWhereClause;
}
export declare function simulateFieldTrimming(requestGroup: RequestGroup, issues: Issue[], options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): Optimization | null;
//# sourceMappingURL=field-trimming-simulator.d.ts.map