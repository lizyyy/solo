import { TsConfigPaths, ResolutionResult } from './types';
export declare class PathResolver {
    private baseUrl;
    private paths;
    private projectRoot;
    constructor(tsconfigPath: string);
    private loadTsConfig;
    resolve(importPath: string, sourceFile?: string): ResolutionResult;
    private findMatchingAlias;
    private applyAlias;
    private resolveRelativePath;
    private checkFileExists;
    getPaths(): TsConfigPaths;
    getBaseUrl(): string;
}
