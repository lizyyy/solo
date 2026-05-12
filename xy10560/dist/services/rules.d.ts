import { Certificate, ServiceDependency, MaintenanceWindow, CheckResult, CertificateStatus } from '../types';
export declare class RuleEngine {
    private readonly EXPIRING_SOON_DAYS;
    private readonly IMMEDIATE_DAYS;
    calculateDaysUntilExpiry(notAfter: string): number;
    determineCertificateStatus(cert: Certificate): CertificateStatus;
    checkSameCertificateMultipleDomains(cert: Certificate): string[];
    checkProductionNoWindow(cert: Certificate, windows: MaintenanceWindow[]): string[];
    checkDependenciesUnconfirmed(deps: ServiceDependency[]): string[];
    checkRollbackPackageMissing(cert: Certificate): string[];
    checkDuplicateRecords(certificates: Certificate[]): Map<string, string[]>;
    needsCoordination(cert: Certificate, deps: ServiceDependency[], windows: MaintenanceWindow[]): boolean;
    generateIdempotencyKey(action: string, targetId: string, timestamp?: string): string;
    validateCertificate(cert: Certificate): string[];
    canRotate(cert: Certificate, deps: ServiceDependency[], windows: MaintenanceWindow[]): {
        canRotate: boolean;
        reasons: string[];
    };
    analyzeCertificate(cert: Certificate, deps: ServiceDependency[], windows: MaintenanceWindow[], allCerts: Certificate[]): CheckResult;
}
