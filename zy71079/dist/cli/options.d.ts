import { CliOptions } from '../types';
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function validateOptions(options: Partial<CliOptions>): ValidationResult;
export declare function normalizeOptions(options: Partial<CliOptions>): CliOptions;
export declare function getScanTargets(options: CliOptions): string[];
//# sourceMappingURL=options.d.ts.map