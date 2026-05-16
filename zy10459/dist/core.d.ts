import { PackageJson, ExportEntry, FileInfo, ImportExample, MissingPath, CheckResult, ExportsValue } from './types';
export declare function readPackageJson(packageDir: string): PackageJson;
export declare function resolveExportsPath(exportsValue: ExportsValue, basePath: string, exportPath: string, conditions?: string[]): ExportEntry[];
export declare function parseExports(pkg: PackageJson, packageDir: string): ExportEntry[];
export declare function scanPackageFiles(packageDir: string): FileInfo[];
export declare function findMissingPaths(exports: ExportEntry[], files: FileInfo[], pkg: PackageJson): MissingPath[];
export declare function generateImportExamples(exports: ExportEntry[], packageName: string): ImportExample[];
export declare function runCheck(packageDir: string, options?: {
    includeImports?: boolean;
}): CheckResult;
