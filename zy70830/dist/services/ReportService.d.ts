import { ReconciliationRecord, Discrepancy, Bed, Patient, CleaningWorkOrder, ReviewDecision } from '../types';
export declare class ReportService {
    generateReconciliationReport(recordId: string): {
        summary: ReconciliationRecord;
        discrepancies: Discrepancy[];
        beds: Bed[];
        patients: Patient[];
        workOrders: CleaningWorkOrder[];
        reviewDecisions: ReviewDecision[];
        statistics: {
            totalDiscrepancies: number;
            resolvedDiscrepancies: number;
            pendingDiscrepancies: number;
            resolutionRate: number;
            criticalDiscrepancies: number;
            highDiscrepancies: number;
            mediumDiscrepancies: number;
            lowDiscrepancies: number;
        };
        generatedAt: Date;
    };
    exportToCSV(data: any[], fields: string[], filename: string): {
        success: boolean;
        csv: string;
        filename: string;
    };
    exportDiscrepanciesToCSV(discrepancies?: Discrepancy[]): {
        success: boolean;
        csv: string;
        filename: string;
    };
    exportBedsToCSV(beds?: Bed[]): {
        success: boolean;
        csv: string;
        filename: string;
    };
    exportPatientsToCSV(patients?: Patient[]): {
        success: boolean;
        csv: string;
        filename: string;
    };
    exportWorkOrdersToCSV(workOrders?: CleaningWorkOrder[]): {
        success: boolean;
        csv: string;
        filename: string;
    };
    generateSummaryStatistics(): {
        bedStatistics: {
            total: number;
            occupied: number;
            vacant: number;
            cleaning: number;
            locked: number;
            occupancyRate: number;
        };
        patientStatistics: {
            total: number;
            admitted: number;
            transferred: number;
            discharged: number;
        };
        cleaningStatistics: {
            total: number;
            pending: number;
            inProgress: number;
            completed: number;
            overdue: number;
            averageCompletionTimeMinutes: number;
        };
        discrepancyStatistics: {
            total: number;
            resolved: number;
            pending: number;
            byType: Record<string, number>;
            bySeverity: Record<string, number>;
            resolutionRate: number;
        };
    };
    getPatientFullReport(patientId: string): {
        patient: Patient | undefined;
        bedHistory: Array<{
            bedId: string;
            bedNumber: string;
            ward: string;
            assignedAt: Date;
            releasedAt?: Date;
        }>;
        transferHistory: Array<{
            fromWard: string;
            toWard: string;
            transferDate: Date;
            reason?: string;
        }>;
        relatedDiscrepancies: Discrepancy[];
        auditTrail: any[];
    };
    generateDashboardData(): {
        summary: {
            totalBeds: number;
            totalPatients: number;
            pendingDiscrepancies: number;
            overdueCleaning: number;
            lastReconciliationDate?: Date;
        };
        wardBreakdown: Array<{
            ward: string;
            totalBeds: number;
            occupiedBeds: number;
            vacantBeds: number;
            occupancyRate: number;
        }>;
        recentDiscrepancies: Discrepancy[];
        alerts: Array<{
            type: string;
            message: string;
            severity: string;
            timestamp: Date;
        }>;
    };
}
export declare const reportService: ReportService;
