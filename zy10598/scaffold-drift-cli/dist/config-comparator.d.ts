import { ConfigEntry, ConfigCheckResult } from './types';
export declare class ConfigComparator {
    compare(repoPath: string, templatePath: string, configEntry: ConfigEntry, templateContent: string | null): Promise<ConfigCheckResult>;
    private parseConfig;
    private parseEnv;
    private generateConfigDiff;
    private generateId;
}
