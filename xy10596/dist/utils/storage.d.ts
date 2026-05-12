import { ProjectState } from '../types';
export declare class Storage {
    private static ensureDirs;
    static exists(): boolean;
    static load(): ProjectState;
    static save(state: ProjectState): void;
    static initialize(state: ProjectState): void;
    static clear(): void;
    static getDataDir(): string;
    static getBackupDir(): string;
    static listBackups(): string[];
    static restoreBackup(backupName: string): void;
}
