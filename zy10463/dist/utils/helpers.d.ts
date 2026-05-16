import { ValidationError } from '../types';
export declare function ensureDir(dirPath: string): void;
export declare function readJsonFile(filePath: string): Record<string, unknown>;
export declare function writeJsonFile(filePath: string, data: unknown, pretty?: boolean): void;
export declare function seededRandom(seed: number): () => number;
export declare function generateId(seed: number, index: number, type: string): string;
export declare function formatErrorForReport(error: ValidationError): string;
export declare function getFieldType(schema: Record<string, unknown>, fieldPath: string): string;
export declare function listAllFields(schema: Record<string, unknown>, prefix?: string): string[];
