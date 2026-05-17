import { TranslationEntry } from './types.js';
export declare function findTranslationFiles(pattern: string, cwd: string): Promise<string[]>;
export declare function readTranslationFile(filePath: string): Promise<Record<string, string>>;
export declare function loadTranslations(filePath: string, language: string): Promise<TranslationEntry[]>;
export declare function extractLanguageFromFilename(filePath: string, pattern?: string): string | null;
export declare function ensureOutputDir(outputDir: string): Promise<void>;
