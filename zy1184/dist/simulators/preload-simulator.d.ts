import { RequestGroup, Issue, Optimization, TableStructure, RepositoryMethodsConfig, SimulationOptions } from '../models';
export declare class PreloadSimulator {
    private options;
    private tableStructures?;
    private repositoryMethods?;
    constructor(options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig);
    simulate(requestGroup: RequestGroup, issues: Issue[]): Optimization | null;
    private isIdLookupQuery;
    private createOptimizedQuery;
}
export declare function simulatePreload(requestGroup: RequestGroup, issues: Issue[], options?: SimulationOptions, tableStructures?: TableStructure[], repositoryMethods?: RepositoryMethodsConfig): Optimization | null;
//# sourceMappingURL=preload-simulator.d.ts.map