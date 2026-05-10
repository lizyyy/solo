import { DamageRecord, DamageSeverity, RepairRecord, RepairStatus, ServiceResult } from '../types';
export interface ReportDamageInput {
    caseIdentifier: string;
    itemName?: string;
    cityIdentifier: string;
    reportedBy: string;
    severity: DamageSeverity;
    description: string;
    damageTime?: string;
    estimatedCost?: number;
}
export declare function reportDamage(input: ReportDamageInput): ServiceResult<DamageRecord>;
export interface ResolveDamageInput {
    damageId: string;
    resolvedBy: string;
    resolution: string;
    responsibility?: string;
}
export declare function resolveDamage(input: ResolveDamageInput): ServiceResult<DamageRecord>;
export interface StartRepairInput {
    damageId?: string;
    caseIdentifier: string;
    itemName?: string;
    startedBy: string;
    description: string;
}
export declare function startRepair(input: StartRepairInput): ServiceResult<RepairRecord>;
export interface CompleteRepairInput {
    repairId: string;
    cost?: number;
    completionNote?: string;
}
export declare function completeRepair(input: CompleteRepairInput): ServiceResult<RepairRecord>;
export declare function listDamageRecords(caseIdentifier?: string, unresolvedOnly?: boolean): ServiceResult<DamageRecord[]>;
export declare function listRepairRecords(caseIdentifier?: string, statusFilter?: RepairStatus): ServiceResult<RepairRecord[]>;
export declare function getDamageSeverityLabel(severity: DamageSeverity): string;
