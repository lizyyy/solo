import { ProgrammingLanguage, FlagMatch, ScanOptions, FlagDefinition } from './types';
export declare function detectLanguage(filePath: string): ProgrammingLanguage;
export declare function getMatchingExtensions(languages: ProgrammingLanguage[]): string[];
export declare function findSourceFiles(options: ScanOptions): Promise<string[]>;
export declare function readFileContent(filePath: string): string;
export declare function extractLineContext(content: string, lineNumber: number, contextRange?: number): string;
export declare function getLineNumber(content: string, charIndex: number): number;
export declare function getColumn(content: string, charIndex: number): number;
export declare function isNegatedContext(content: string, matchIndex: number, language: ProgrammingLanguage): boolean;
export declare function findAllFlagMatches(filePath: string, content: string, flagDefinitions: FlagDefinition[]): FlagMatch[];
export declare function scanSourceFiles(options: ScanOptions): Promise<{
    matches: FlagMatch[];
    filesScanned: string[];
    errors: string[];
}>;
