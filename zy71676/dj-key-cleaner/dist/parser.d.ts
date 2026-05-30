import type { RawTrack, ParseWarning } from './models.js';
export interface ParseResult {
    tracks: RawTrack[];
    warnings: ParseWarning[];
    totalRows: number;
    successfulRows: number;
}
export declare function parseCSV(filePath: string): ParseResult;
export declare function parseJSON(filePath: string): ParseResult;
export declare function parseFile(filePath: string): ParseResult;
export declare function parseFiles(filePaths: string[]): ParseResult;
