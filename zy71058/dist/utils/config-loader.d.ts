import { SecretRule, ExceptionItem, ValidationError, ScanOptions } from '../types';
export declare function loadRules(rulesPath?: string): SecretRule[];
export declare function loadExceptions(exceptionsPath?: string): ExceptionItem[];
export declare function validateOptions(options: Record<string, unknown> | ScanOptions): ValidationError[];
export declare function ensureOutputDir(outputDir: string): void;
