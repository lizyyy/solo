import { DeliveryOrder, ElevatorInfo, InstallationRecord, MissingPartRecord, RescheduleRecord, DamageCompensation, AbnormalityCheckResult, ResponsibleParty } from '../types';
export declare class AbnormalityChecker {
    checkAllAbnormalities(order: DeliveryOrder, elevator?: ElevatorInfo, installations?: InstallationRecord[], missingParts?: MissingPartRecord[], reschedules?: RescheduleRecord[], compensations?: DamageCompensation[]): AbnormalityCheckResult;
    private checkElevatorConflict;
    private checkMissingParts;
    private checkRescheduleConflict;
    private checkDamage;
    private checkInstallationIssues;
    private checkDuplicateCompensation;
    determineResponsibility(order: DeliveryOrder, abnormalityType: string): ResponsibleParty;
}
