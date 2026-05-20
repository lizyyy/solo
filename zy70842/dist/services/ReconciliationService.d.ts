import { ReconciliationRecord, Discrepancy, ReviewResult, ReconciliationSummary } from '../models/types';
declare class ReconciliationService {
    createReconciliation(applicationId: string): Promise<ReconciliationRecord | null>;
    autoCheck(reconciliationId: string): Promise<Discrepancy[]>;
    private checkLicenseExpiry;
    private checkTimeConflict;
    private checkMissingDocuments;
    private checkFeeMismatch;
    private getLicenseTypeName;
    private checkDepositDeduction;
    private generateDepositDeductionExplanation;
    private getDepositDeductionTypeName;
    reviewDiscrepancy(reconciliationId: string, discrepancyId: string, reviewer: string, result: ReviewResult, notes: string, adjustmentAmount?: number, adjustmentReason?: string): Promise<ReconciliationRecord | null>;
    private recalculateAmount;
    completeReconciliation(reconciliationId: string, reviewer: string): Promise<ReconciliationRecord | null>;
    getSummary(): ReconciliationSummary;
    batchCreateAll(): Promise<ReconciliationRecord[]>;
}
export declare const reconciliationService: ReconciliationService;
export {};
