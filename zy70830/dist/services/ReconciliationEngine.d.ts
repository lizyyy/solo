import { Patient, Discrepancy, ReconciliationRecord } from '../types';
export declare class ReconciliationEngine {
    private readonly CLEANING_TIMEOUT_MINUTES;
    runReconciliation(performedBy: string, ward?: string): Promise<ReconciliationRecord>;
    private updateReconciliationStats;
    private checkStatusMismatch;
    private checkDuplicateOccupancy;
    private checkTransferLockBed;
    private checkCleaningTimeout;
    private checkPatientsInCleaning;
    private checkDataConsistency;
    private createDiscrepancy;
    private getAffectedFields;
    private getDataSources;
    getPatientHistoryTrace(patientId: string): {
        patient: Patient | undefined;
        history: any[];
        auditLogs: any[];
        relatedDiscrepancies: Discrepancy[];
    };
}
export declare const reconciliationEngine: ReconciliationEngine;
