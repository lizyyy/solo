import { RequestGroup, Issue, Optimization, TableStructure, RepositoryMethodsConfig, SimulationOptions } from '../models';
export declare class CursorPaginationSimulator {
    private options;
    private tableStructures?;
    private repositoryMethods?;
    constructor(options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig);
    simulate(requestGroup: RequestGroup, issues: Issue[]): Optimization | null;
    private getMinOffset;
    private getMaxOffset;
    private estimateDataTransfer;
    private estimateQueryDataTransfer;
    private estimateOptimizedDataTransfer;
    private createOptimizedQuery;
    private getOrderByColumn;
    private estimateCursorValue;
    private estimateQueryCost;
    private estimateCursorCost;
}
export declare function simulateCursorPagination(requestGroup: RequestGroup, issues: Issue[], options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): Optimization | null;
//# sourceMappingURL=cursor-pagination-simulator.d.ts.map