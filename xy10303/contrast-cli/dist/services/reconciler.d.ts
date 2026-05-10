import { DataStore } from './dataStore';
import { Appointment, UsageRecord, ReconciliationResult, ReconciliationIssue, DailyReport } from '../models';
interface AppointmentReconciliation {
    appointment: Appointment;
    status: 'pending' | 'completed' | 'refunded' | 'missing_usage' | 'excess_usage';
    usage?: UsageRecord;
    plannedDose: number;
    actualDose: number;
    doseDifference: number;
    issues: ReconciliationIssue[];
}
export declare class Reconciler {
    private store;
    constructor(store: DataStore);
    reconcile(date: string): ReconciliationResult;
    private reconcileAppointment;
    private checkRefundConsistency;
    private generateBatchSummaries;
    getPendingItems(date: string): AppointmentReconciliation[];
    generateDailyReport(date: string): DailyReport;
}
export type { AppointmentReconciliation };
