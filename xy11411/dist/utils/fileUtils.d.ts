import { DataSourceType } from '../models/types';
export declare function calculateFileHash(filePath: string): string;
export declare function calculateContentHash(content: string): string;
export declare function fileExists(filePath: string): boolean;
export declare function directoryExists(dirPath: string): boolean;
export declare function detectFileType(filePath: string): string;
export declare function detectSourceType(fileName: string): DataSourceType;
export interface ParseResult {
    headers: string[];
    rows: Record<string, any>[];
}
export declare function parseCsvFile(filePath: string): Promise<ParseResult>;
export declare function parseExcelFile(filePath: string): ParseResult;
export declare function parseDataFile(filePath: string): Promise<ParseResult>;
export declare function formatDate(timestamp: number): string;
export declare function formatCurrency(amount: number): string;
