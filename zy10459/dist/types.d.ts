export interface PackageJson {
    name?: string;
    version?: string;
    main?: string;
    module?: string;
    types?: string;
    exports?: ExportsConfig;
    imports?: Record<string, string | Record<string, string>>;
    files?: string[];
}
export type ExportsConfig = string | Record<string, ExportsValue> | ExportsValue[];
export type ExportsValue = string | null | Record<string, string | null> | ExportsValue[];
export interface ExportEntry {
    path: string;
    exportPath: string;
    resolvedPath: string | null;
    conditions: string[];
    fileExists: boolean;
    error?: string;
    source: 'exports' | 'main' | 'module' | 'types';
}
export interface FileInfo {
    path: string;
    exists: boolean;
    isDirectory: boolean;
    isFile: boolean;
    absolutePath: string;
}
export interface ImportExample {
    importPath: string;
    shouldWork: boolean;
    actualPath?: string;
    error?: string;
    sourceLocation?: string;
}
export interface MissingPath {
    path: string;
    expectedInExports: boolean;
    expectedInFiles: boolean;
    reason: string;
    actualLocation?: string;
}
export interface CheckResult {
    packageName: string;
    packageVersion: string;
    checkedAt: string;
    packageDir: string;
    exports: ExportEntry[];
    files: FileInfo[];
    importExamples: ImportExample[];
    missingPaths: MissingPath[];
    summary: {
        totalExports: number;
        validExports: number;
        invalidExports: number;
        missingFiles: number;
        totalFiles: number;
    };
    errors: string[];
    warnings: string[];
}
export interface CliOptions {
    packageDir: string;
    outputDir: string;
    format: ('json' | 'markdown' | 'terminal' | 'all')[];
    verbose: boolean;
    strict: boolean;
    includeImports: boolean;
}
