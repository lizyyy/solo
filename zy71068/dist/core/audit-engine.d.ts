import { AuditConfig, AuditResult } from '../types.js';
declare const VERSION = "1.0.0";
export declare class AuditEngine {
    private config;
    private fontScanner;
    private cssParser;
    private licenseManager;
    private riskAssessor;
    private reportGenerator;
    constructor(config: AuditConfig);
    validateInputs(): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    run(verbose?: boolean): Promise<{
        result: AuditResult;
        exitCode: number;
    }>;
    private buildEmptyResult;
}
export { VERSION };
