export type Environment = 'test' | 'preprod' | 'production';
export type CertificateStatus = 'pending_import' | 'active' | 'expiring_soon' | 'expired' | 'in_rotation' | 'needs_coordination' | 'completed' | 'rolled_back' | 'failed';
export type DependencyStatus = 'pending_notification' | 'notified' | 'acknowledged' | 'rejected' | 'not_required';
export type MaintenanceWindowStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'not_applicable';
export type ActionType = 'import' | 'check' | 'rotate' | 'notify' | 'coordinate' | 'rollback' | 'manual_edit' | 'system_check';
export interface Certificate {
    id: string;
    name: string;
    serialNumber: string;
    issuer: string;
    subject: string;
    notBefore: string;
    notAfter: string;
    domains: string[];
    environment: Environment;
    status: CertificateStatus;
    rollbackPackageId?: string;
    hasRollbackPackage: boolean;
    createdAt: string;
    updatedAt: string;
    lastCheckedAt?: string;
    notes?: string;
}
export interface Domain {
    id: string;
    name: string;
    certificateId: string;
    environment: Environment;
    serviceNames: string[];
    isPrimary: boolean;
    createdAt: string;
}
export interface ServiceDependency {
    id: string;
    serviceName: string;
    dependsOn: string[];
    isCritical: boolean;
    environment: Environment;
    status: DependencyStatus;
    lastNotifiedAt?: string;
    acknowledgementDeadline?: string;
    createdAt: string;
    updatedAt: string;
}
export interface MaintenanceWindow {
    id: string;
    name: string;
    environment: Environment;
    startTime: string;
    endTime: string;
    affectedServices: string[];
    affectedCertificates: string[];
    status: MaintenanceWindowStatus;
    createdAt: string;
}
export interface ExecutionRecord {
    id: string;
    action: ActionType;
    targetType: 'certificate' | 'domain' | 'dependency' | 'window' | 'system';
    targetId?: string;
    status: 'success' | 'failed' | 'partial';
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    operator: string;
    details: {
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        changes?: string[];
        errorMessage?: string;
        errorStack?: string;
        metadata?: Record<string, unknown>;
    };
    idempotencyKey?: string;
}
export interface ImportData {
    certificates: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'hasRollbackPackage'>[];
    domains: Omit<Domain, 'id' | 'createdAt'>[];
    dependencies: Omit<ServiceDependency, 'id' | 'createdAt' | 'updatedAt'>[];
    windows: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'status'>[];
}
export interface Store {
    certificates: Certificate[];
    domains: Domain[];
    dependencies: ServiceDependency[];
    windows: MaintenanceWindow[];
    executionRecords: ExecutionRecord[];
    version: string;
    lastUpdated: string;
}
export interface CheckResult {
    certificateId: string;
    certificateName: string;
    environment: Environment;
    domains: string[];
    daysUntilExpiry: number;
    status: CertificateStatus;
    issues: string[];
    warnings: string[];
    dependencies: {
        serviceName: string;
        status: DependencyStatus;
        isCritical: boolean;
    }[];
    hasMaintenanceWindow: boolean;
    hasRollbackPackage: boolean;
}
export interface ReportSummary {
    immediate: CheckResult[];
    thisWeek: CheckResult[];
    needsCoordination: CheckResult[];
    completed: CheckResult[];
    totalCount: number;
    criticalIssues: string[];
}
