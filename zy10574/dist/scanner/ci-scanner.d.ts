import { CIConfig, AnomalySample } from '../types.js';
export declare function scanCIConfigs(rootPath: string): Promise<{
    configs: CIConfig[];
    anomalies: AnomalySample[];
}>;
