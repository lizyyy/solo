import { ReleaseData, ServiceReleasePlan, Dependency, DatabaseMigration, ConfigSwitch, RollbackContact, Waiver } from './types';
export declare function createSampleServices(): ServiceReleasePlan[];
export declare function createSampleDependencies(): Dependency[];
export declare function createSampleMigrations(): DatabaseMigration[];
export declare function createSampleSwitches(): ConfigSwitch[];
export declare function createSampleContacts(): RollbackContact[];
export declare function createSampleWaivers(): Waiver[];
export declare function createSampleData(releasePlanId: string, releaseName: string): ReleaseData;
export declare function createSuccessSampleData(releasePlanId: string, releaseName: string): ReleaseData;
//# sourceMappingURL=samples.d.ts.map