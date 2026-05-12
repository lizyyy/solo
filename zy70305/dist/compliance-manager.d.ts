import { ContractDiff, Exemption, Confirmation, FilterOptions, ServiceConfig } from './types';
export declare class ComplianceManager {
    private exemptions;
    private confirmations;
    private services;
    constructor(services: ServiceConfig[], exemptions?: Exemption[], confirmations?: Confirmation[]);
    addExemption(serviceName: string, path: string, method: string, field: string | undefined, reason: string, expiresInDays: number, createdBy: string): Exemption;
    removeExemption(id: string): boolean;
    getExemptions(): Exemption[];
    addConfirmation(diff: ContractDiff, confirmedBy: string, notes?: string): Confirmation;
    removeConfirmation(diffId: string): boolean;
    getConfirmations(): Confirmation[];
    getConfirmationForDiff(diff: ContractDiff): Confirmation | undefined;
    isExempted(diff: ContractDiff): boolean;
    isConfirmed(diff: ContractDiff): boolean;
    applyFilters(diffs: ContractDiff[], options: FilterOptions): ContractDiff[];
    filterByExemptionStatus(diffs: ContractDiff[], showExempted?: boolean): ContractDiff[];
    filterByConfirmationStatus(diffs: ContractDiff[], showConfirmed?: boolean): ContractDiff[];
    getOwnersForService(serviceName: string): string[];
    private computeDiffHash;
}
//# sourceMappingURL=compliance-manager.d.ts.map