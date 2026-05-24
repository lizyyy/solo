export declare function fileExists(filePath: string): Promise<boolean>;
export declare function isDirectory(dirPath: string): Promise<boolean>;
export declare function readJsonFile<T = unknown>(filePath: string): Promise<T>;
export declare function writeJsonFile(filePath: string, data: unknown, pretty?: boolean): Promise<void>;
export declare function writeTextFile(filePath: string, content: string): Promise<void>;
export declare function scanDirectory(dir: string, patterns: string[], ignore?: string[]): Promise<string[]>;
export declare function getFileExtension(fileName: string): string;
export declare function getRelativePath(basePath: string, filePath: string): string;
export declare function normalizePath(filePath: string): string;
