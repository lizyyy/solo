import { RequestGroup, Issue, SimulationResult, TableStructure, RepositoryMethodsConfig, SimulationOptions } from '../models';
export declare class QuerySimulator {
    private options;
    private tableStructures?;
    private repositoryMethods?;
    constructor(options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig);
    simulate(requestGroup: RequestGroup, issues: Issue[]): SimulationResult;
    simulateBatch(requestGroups: RequestGroup[], issuesMap: Map<string, Issue[]>): SimulationResult[];
    private createComparison;
    static simulate(requestGroup: RequestGroup, issues: Issue[], options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): SimulationResult;
    static simulateBatch(requestGroups: RequestGroup[], issuesMap: Map<string, Issue[]>, options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): SimulationResult[];
}
export declare function simulateQuery(requestGroup: RequestGroup, issues: Issue[], options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): SimulationResult;
export declare function simulateQueriesBatch(requestGroups: RequestGroup[], issuesMap: Map<string, Issue[]>, options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): SimulationResult[];
//# sourceMappingURL=query-simulator.d.ts.map