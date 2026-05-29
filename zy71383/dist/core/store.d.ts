import { ConfigFile, ChangeRecord, DefaultValue, SecretPlaceholder, EnvironmentName } from './types';
export declare class ConfigStore {
    private data;
    constructor();
    private ensureDataDir;
    private loadData;
    private loadFile;
    private loadSecretPatterns;
    private getDefaultSecretPatterns;
    private saveData;
    private saveFile;
    addConfig(config: ConfigFile): void;
    getConfigs(): ConfigFile[];
    getConfigByEnvironment(env: EnvironmentName): ConfigFile | undefined;
    addChange(change: ChangeRecord): void;
    getChanges(): ChangeRecord[];
    getChangesByKey(key: string): ChangeRecord[];
    addDefault(defaultValue: DefaultValue): void;
    getDefaults(): DefaultValue[];
    getDefaultByKey(key: string): DefaultValue | undefined;
    getSecretPatterns(): SecretPlaceholder[];
    getEnvironments(): EnvironmentName[];
    clearAll(): void;
}
export declare const store: ConfigStore;
