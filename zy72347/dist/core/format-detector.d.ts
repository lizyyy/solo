import { ValueFormat, RawValue } from '../types';
export declare function detectFormat(value: string): ValueFormat;
export declare function parseValue(value: string): RawValue;
export declare function detectMixedFormat(values: RawValue[]): boolean;
export declare function normalizeValue(value: RawValue, targetFormat: 'decimal' | 'percentage'): number;
export declare function formatValue(numericValue: number, targetFormat: 'decimal' | 'percentage'): string;
