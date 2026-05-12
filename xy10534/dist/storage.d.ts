import { ReleaseData, ServiceReleasePlan, Dependency, DatabaseMigration, ConfigSwitch, RollbackContact, Waiver, CheckHistory, ManualCorrection } from './types';
export declare class Storage {
    private dataDir;
    private dataFile;
    constructor(dataDir?: string);
    ensureDirectory(): void;
    initialize(releasePlanId: string, releaseName: string): ReleaseData;
    exists(): boolean;
    load(): ReleaseData;
    save(data: ReleaseData): void;
    backup(): string;
    addServices(data: ReleaseData, services: ServiceReleasePlan[]): ReleaseData;
    addDependencies(data: ReleaseData, dependencies: Dependency[]): ReleaseData;
    addMigrations(data: ReleaseData, migrations: DatabaseMigration[]): ReleaseData;
    addSwitches(data: ReleaseData, switches: ConfigSwitch[]): ReleaseData;
    addContacts(data: ReleaseData, contacts: RollbackContact[]): ReleaseData;
    addWaiver(data: ReleaseData, waiver: Waiver): ReleaseData;
    addCheckHistory(data: ReleaseData, history: CheckHistory): ReleaseData;
    addCorrection(data: ReleaseData, correction: ManualCorrection): ReleaseData;
    getDataDir(): string;
    getDataFile(): string;
}
//# sourceMappingURL=storage.d.ts.map