import { ReleaseData, CheckResult, CheckSummary } from './types';
export declare function checkDependencies(data: ReleaseData): CheckResult[];
export declare function checkMigrations(data: ReleaseData): CheckResult[];
export declare function checkSwitches(data: ReleaseData): CheckResult[];
export declare function checkContacts(data: ReleaseData): CheckResult[];
export declare function checkWaivers(data: ReleaseData, currentTime?: Date): CheckResult[];
export declare function calculateRecommendedOrder(data: ReleaseData): string[];
export declare function applyWaivers(results: CheckResult[], data: ReleaseData): CheckResult[];
export declare function runAllChecks(data: ReleaseData): {
    results: CheckResult[];
    summary: CheckSummary;
};
//# sourceMappingURL=rules.d.ts.map