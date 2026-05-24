import { ValidationError, CliOptions } from './types';
export declare function validateInput(options: CliOptions): ValidationError[];
export declare function hasCriticalErrors(errors: ValidationError[]): boolean;
export declare function formatValidationErrors(errors: ValidationError[]): string;
