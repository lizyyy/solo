import { ResolutionResult, Conflict, EnvironmentResolution } from './types';

export class ConflictDetector {
  detectConflicts(resolutionsByEnv: EnvironmentResolution[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const importPaths = this.getAllImportPaths(resolutionsByEnv);

    for (const importPath of importPaths) {
      const envResults = this.getResultsForPath(resolutionsByEnv, importPath);
      
      const fileConflict = this.checkFileExistenceConflict(importPath, envResults);
      if (fileConflict) {
        conflicts.push(fileConflict);
      }

      const resolutionConflict = this.checkResolutionMismatch(importPath, envResults);
      if (resolutionConflict) {
        conflicts.push(resolutionConflict);
      }
    }

    return conflicts;
  }

  private getAllImportPaths(resolutionsByEnv: EnvironmentResolution[]): string[] {
    const importPaths = new Set<string>();
    for (const envResolution of resolutionsByEnv) {
      for (const result of envResolution.results) {
        importPaths.add(result.originalPath);
      }
    }
    return Array.from(importPaths);
  }

  private getResultsForPath(
    resolutionsByEnv: EnvironmentResolution[],
    importPath: string
  ): { [env: string]: ResolutionResult } {
    const results: { [env: string]: ResolutionResult } = {};
    for (const envResolution of resolutionsByEnv) {
      const result = envResolution.results.find(r => r.originalPath === importPath);
      if (result) {
        results[envResolution.environment] = result;
      }
    }
    return results;
  }

  private checkFileExistenceConflict(
    importPath: string,
    envResults: { [env: string]: ResolutionResult }
  ): Conflict | undefined {
    const environments = Object.keys(envResults);
    if (environments.length < 2) return undefined;

    const fileExistsValues = environments.map(env => envResults[env].fileExists);
    const allSame = fileExistsValues.every(v => v === fileExistsValues[0]);

    if (!allSame) {
      const conflictEnvs: Conflict['environments'] = {};
      for (const env of environments) {
        conflictEnvs[env] = {
          resolvedPath: envResults[env].resolvedPath,
          fileExists: envResults[env].fileExists,
        };
      }
      return {
        importPath,
        environments: conflictEnvs,
        type: 'file_not_found',
        description: 'File existence differs across environments',
      };
    }

    return undefined;
  }

  private checkResolutionMismatch(
    importPath: string,
    envResults: { [env: string]: ResolutionResult }
  ): Conflict | undefined {
    const environments = Object.keys(envResults);
    if (environments.length < 2) return undefined;

    const resolvedPaths = environments.map(env => envResults[env].resolvedPath);
    const allSame = resolvedPaths.every(p => p === resolvedPaths[0]);

    if (!allSame) {
      const conflictEnvs: Conflict['environments'] = {};
      for (const env of environments) {
        conflictEnvs[env] = {
          resolvedPath: envResults[env].resolvedPath,
          fileExists: envResults[env].fileExists,
        };
      }
      return {
        importPath,
        environments: conflictEnvs,
        type: 'resolution_mismatch',
        description: 'Resolved path differs across environments',
      };
    }

    const aliases = environments.map(env => envResults[env].matchedAlias);
    const aliasesSame = aliases.every(a => a === aliases[0]);

    if (!aliasesSame) {
      const conflictEnvs: Conflict['environments'] = {};
      for (const env of environments) {
        conflictEnvs[env] = {
          resolvedPath: envResults[env].resolvedPath,
          fileExists: envResults[env].fileExists,
        };
      }
      return {
        importPath,
        environments: conflictEnvs,
        type: 'alias_mismatch',
        description: 'Matched alias differs across environments',
      };
    }

    return undefined;
  }
}