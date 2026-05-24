import { CheckConfig, CheckResult } from './types';
export interface CheckOptions {
    sourceLocale?: string;
    verbose?: boolean;
}
export interface CheckResultWithErrors {
    results: CheckResult[];
    parseErrors: Array<{
        file: string;
        error: string;
    }>;
}
export declare function runChecks(inputFiles: string[], checkConfigs: CheckConfig[], options?: CheckOptions): CheckResultWithErrors;
export declare function loadConfigFile(configPath: string): {
    checks: CheckConfig[];
    outputDir?: string;
    formats?: string[];
};
export declare function generateConfigHash(config: any): string;
