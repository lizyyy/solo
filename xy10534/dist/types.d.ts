export interface ServiceReleasePlan {
    id: string;
    name: string;
    version: string;
    plannedTime: string;
    windowStart: string;
    windowEnd: string;
    status: 'planned' | 'in-progress' | 'completed' | 'failed';
    environment: string;
    notes?: string;
}
export interface Dependency {
    id: string;
    callerServiceId: string;
    calleeServiceId: string;
    dependencyType: 'hard' | 'soft';
    windowAlignmentRequired: boolean;
    description?: string;
}
export interface DatabaseMigration {
    id: string;
    serviceId: string;
    scriptName: string;
    version: string;
    hasRollback: boolean;
    rollbackScript?: string;
    migrationType: 'schema' | 'data' | 'both';
    preDeploy: boolean;
    postDeploy: boolean;
    executed: boolean;
    executedAt?: string;
}
export interface ConfigSwitch {
    id: string;
    serviceId: string;
    key: string;
    targetValue: string;
    currentValue?: string;
    preConfigured: boolean;
    switchOrder: number;
    description?: string;
}
export interface RollbackContact {
    id: string;
    serviceId: string;
    name: string;
    role: string;
    phone: string;
    email: string;
    isPrimary: boolean;
    available: boolean;
}
export interface Waiver {
    id: string;
    relatedCheckId: string;
    serviceId?: string;
    reason: string;
    approvedBy: string;
    approvedAt: string;
    expiresAt: string;
    isActive: boolean;
}
export type CheckStatus = 'blocking' | 'warning' | 'passed' | 'waived';
export interface CheckResult {
    id: string;
    checkType: string;
    serviceId?: string;
    status: CheckStatus;
    message: string;
    detail: string;
    action?: string;
    waiverId?: string;
}
export interface ManualCorrection {
    id: string;
    entityType: string;
    entityId: string;
    fieldName: string;
    beforeValue: string;
    afterValue: string;
    operator: string;
    timestamp: string;
    reason: string;
}
export interface ReleaseData {
    releasePlanId: string;
    releaseName: string;
    createdAt: string;
    updatedAt: string;
    services: ServiceReleasePlan[];
    dependencies: Dependency[];
    migrations: DatabaseMigration[];
    switches: ConfigSwitch[];
    contacts: RollbackContact[];
    waivers: Waiver[];
    checkHistory: CheckHistory[];
    corrections: ManualCorrection[];
}
export interface CheckHistory {
    id: string;
    timestamp: string;
    results: CheckResult[];
    summary: CheckSummary;
    executedBy: string;
}
export interface CheckSummary {
    total: number;
    blocking: number;
    warning: number;
    passed: number;
    waived: number;
    canRelease: boolean;
    recommendedOrder: string[];
}
//# sourceMappingURL=types.d.ts.map