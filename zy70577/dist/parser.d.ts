import { LogEntry, BadLine, CLIOptions } from './types';
import { LOG_PATTERNS } from './constants';
interface ParseResult {
    entries: LogEntry[];
    badLines: BadLine[];
    totalLines: number;
}
export declare class LogParser {
    private options;
    private patterns;
    constructor(options: CLIOptions);
    private autoDetectPatterns;
    parse(): Promise<ParseResult>;
    private parseLine;
    private isValidEntry;
    detectFormatFromContent(content: string): keyof typeof LOG_PATTERNS | null;
}
export declare function parseLogFile(options: CLIOptions): Promise<ParseResult>;
export {};
