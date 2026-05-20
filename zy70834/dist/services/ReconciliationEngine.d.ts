import { Student, HealthCheckRecord, MedicationAuthorization, ReconciliationResult, RecordStatus } from '../types';
export declare class ReconciliationEngine {
    private students;
    private healthChecks;
    private medications;
    private results;
    private reconciliationDate;
    constructor(reconciliationDate?: string);
    loadData(students: Student[], healthChecks: HealthCheckRecord[], medications: MedicationAuthorization[]): void;
    performReconciliation(): ReconciliationResult[];
    private checkHealthCheckDiscrepancies;
    private checkMedicationDiscrepancies;
    private createDiscrepancy;
    private determineStatus;
    getResults(): ReconciliationResult[];
    getResultsByStatus(status: RecordStatus): ReconciliationResult[];
    getResultById(id: string): ReconciliationResult | undefined;
    updateResult(updatedResult: ReconciliationResult): void;
}
