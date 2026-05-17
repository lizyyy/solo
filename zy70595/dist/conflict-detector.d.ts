import { Conflict, EnvironmentResolution } from './types';
export declare class ConflictDetector {
    detectConflicts(resolutionsByEnv: EnvironmentResolution[]): Conflict[];
    private getAllImportPaths;
    private getResultsForPath;
    private checkFileExistenceConflict;
    private checkResolutionMismatch;
}
