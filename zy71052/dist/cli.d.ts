import { CLIOptions, ValidationError } from './types';
export declare function parseCLIArguments(): CLIOptions;
export declare function validateOptions(options: CLIOptions): ValidationError[];
export declare function ensureOutputDirectory(outputPath: string): void;
export declare function checkExistingFiles(outputPath: string, formats: string[]): {
    exists: boolean;
    files: string[];
};
