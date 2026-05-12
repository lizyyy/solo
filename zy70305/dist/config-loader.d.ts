import { CliConfig, Exemption, Confirmation, Anomaly } from './types';
export declare class ConfigLoader {
    private baseDir;
    constructor(baseDir?: string);
    loadCliConfig(configPath: string): {
        config: CliConfig;
        anomalies: Anomaly[];
    };
    loadExemptions(exemptionsPath: string): {
        exemptions: Exemption[];
        anomalies: Anomaly[];
    };
    loadConfirmations(confirmationsPath: string): {
        confirmations: Confirmation[];
        anomalies: Anomaly[];
    };
    saveConfirmations(confirmationsPath: string, confirmations: Confirmation[]): void;
    saveExemptions(exemptionsPath: string, exemptions: Exemption[]): void;
    private resolvePath;
    private parseFile;
    private validateAndTransformCliConfig;
    private validateExemptions;
    private validateConfirmations;
}
//# sourceMappingURL=config-loader.d.ts.map