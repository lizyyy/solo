import { FlagDefinition, ScanOptions, ProgrammingLanguage } from './types';
export declare function loadFlagDefinitions(filePath: string): FlagDefinition[];
export declare function mergeScanOptions(overrides: Partial<ScanOptions>): ScanOptions;
export declare function parseLanguages(languagesStr?: string): ProgrammingLanguage[];
export declare function parsePatterns(patternsStr?: string): string[];
export declare function ensureOutputDir(outputDir: string): void;
