export interface TsConfigPaths {
    [alias: string]: string[];
}
export interface TsConfig {
    compilerOptions?: {
        baseUrl?: string;
        paths?: TsConfigPaths;
    };
}
export interface ImportStatement {
    lineNumber: number;
    rawLine: string;
    importPath: string;
    isTypeImport: boolean;
    sourceFile?: string;
}
export interface ResolutionResult {
    originalPath: string;
    resolvedPath: string;
    fileExists: boolean;
    matchedAlias?: string;
    error?: string;
}
export interface EnvironmentResolution {
    environment: string;
    results: ResolutionResult[];
}
export interface Conflict {
    importPath: string;
    environments: {
        [env: string]: {
            resolvedPath: string;
            fileExists: boolean;
        };
    };
    type: 'file_not_found' | 'resolution_mismatch' | 'alias_mismatch';
    description: string;
}
export interface DirtyLine {
    lineNumber: number;
    rawLine: string;
    reason: string;
    category: 'parse_error' | 'invalid_format' | 'unsupported_syntax';
}
export interface EnvironmentConfig {
    name: string;
    tsconfigPath: string;
    paths: TsConfigPaths;
}
export interface DiagnosticReport {
    summary: {
        totalImports: number;
        validImports: number;
        dirtyLines: number;
        conflicts: number;
    };
    paths: TsConfigPaths;
    environmentConfigs: EnvironmentConfig[];
    resolutions: EnvironmentResolution[];
    conflicts: Conflict[];
    dirtyLines: DirtyLine[];
    timestamp: string;
}
