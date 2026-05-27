import { RegistrationRecord, WaitlistRecord, CheckInRecord, BlacklistRecord, ReconciliationRecord, ReconciliationBatch, ActivityType } from '../types';
export declare class ReconciliationEngine {
    private createDiscrepancy;
    private createAuditLog;
    private normalizePhone;
    private isSamePerson;
    private findDuplicates;
    private checkBlacklist;
    private findWaitlistPromotions;
    processReconciliation(batchName: string, activityType: ActivityType, activityName: string, registrations: RegistrationRecord[], waitlist: WaitlistRecord[], checkIns: CheckInRecord[], blacklist: BlacklistRecord[], operator: string): {
        batch: ReconciliationBatch;
        records: ReconciliationRecord[];
    };
    recalculateStatistics(batch: ReconciliationBatch, records: ReconciliationRecord[]): ReconciliationBatch;
}
