import { ScanOptions, ScanResult, SecretRule, ExceptionItem } from '../types';
export interface ScanEngineConfig {
    options: ScanOptions;
    rules: SecretRule[];
    exceptions: ExceptionItem[];
}
export declare class ScanEngine {
    private config;
    private findings;
    private errors;
    private warnings;
    private scannedFiles;
    private constructorWarnings;
    constructor(config: ScanEngineConfig);
    scan(): Promise<ScanResult>;
    private scanValuesFile;
    private scanTemplateDir;
    private scanRenderedTemplate;
    private applyExceptionsToFindings;
    private dedupeFindings;
    private buildResult;
}
