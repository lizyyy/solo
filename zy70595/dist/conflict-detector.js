"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictDetector = void 0;
class ConflictDetector {
    detectConflicts(resolutionsByEnv) {
        const conflicts = [];
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
    getAllImportPaths(resolutionsByEnv) {
        const importPaths = new Set();
        for (const envResolution of resolutionsByEnv) {
            for (const result of envResolution.results) {
                importPaths.add(result.originalPath);
            }
        }
        return Array.from(importPaths);
    }
    getResultsForPath(resolutionsByEnv, importPath) {
        const results = {};
        for (const envResolution of resolutionsByEnv) {
            const result = envResolution.results.find(r => r.originalPath === importPath);
            if (result) {
                results[envResolution.environment] = result;
            }
        }
        return results;
    }
    checkFileExistenceConflict(importPath, envResults) {
        const environments = Object.keys(envResults);
        if (environments.length < 2)
            return undefined;
        const fileExistsValues = environments.map(env => envResults[env].fileExists);
        const allSame = fileExistsValues.every(v => v === fileExistsValues[0]);
        if (!allSame) {
            const conflictEnvs = {};
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
    checkResolutionMismatch(importPath, envResults) {
        const environments = Object.keys(envResults);
        if (environments.length < 2)
            return undefined;
        const resolvedPaths = environments.map(env => envResults[env].resolvedPath);
        const allSame = resolvedPaths.every(p => p === resolvedPaths[0]);
        if (!allSame) {
            const conflictEnvs = {};
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
            const conflictEnvs = {};
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
exports.ConflictDetector = ConflictDetector;
