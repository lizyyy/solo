import { WidthCalculationResult } from './types';
export declare function calculateWidth(text: string): WidthCalculationResult;
export declare function getCharWidth(codePoint: number): number;
export declare function getWidthExplanation(result: WidthCalculationResult): string;
