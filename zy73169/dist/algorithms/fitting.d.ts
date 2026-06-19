import type { Sample, FittingMethod, FittingResult } from '../models/types';
export declare function calculateFitting(samples: Sample[], method: FittingMethod, calculatedBy: string, excludeAnomalies?: boolean, degree?: number): FittingResult;
export declare function predict(x: number, coefficients: number[], method: FittingMethod): number;
export declare function formatEquation(coefficients: number[], method: FittingMethod, degree?: number): string;
