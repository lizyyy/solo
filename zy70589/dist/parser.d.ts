import { ParseResult, ParseError, BaselineEntry } from './types.js';
export declare function parseScanReport(filePath: string): Promise<ParseResult>;
export declare function parseBaseline(filePath: string): Promise<{
    success: boolean;
    baseline: BaselineEntry[];
    errors: ParseError[];
}>;
