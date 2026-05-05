export declare function readFile(filePath: string): string;
export declare function writeFile(filePath: string, content: string): void;
export declare function readJsonFile<T = any>(filePath: string): T;
export declare function writeJsonFile(filePath: string, data: any): void;
export declare function readCsvFile(filePath: string, delimiter?: string): string[][];
export declare function writeCsvFile(filePath: string, rows: string[][]): void;
export declare function listFiles(dirPath: string, pattern?: string): string[];
export declare function ensureDir(dirPath: string): void;
export declare function fileExists(filePath: string): boolean;
export declare function getFileSize(filePath: string): number;
//# sourceMappingURL=file-utils.d.ts.map