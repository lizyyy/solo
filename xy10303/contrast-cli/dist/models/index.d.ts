export interface Appointment {
    appointmentId: string;
    patientName: string;
    patientId?: string;
    scheduledDate: string;
    scheduledTime: string;
    contrastAgent: string;
    plannedDose: number;
    department?: string;
    doctor?: string;
}
export interface Batch {
    batchNumber: string;
    contrastAgent: string;
    totalVolume: number;
    expiryDate: string;
    importDate: string;
    manufacturer?: string;
}
export interface UsageRecord {
    appointmentId: string;
    batchNumber: string;
    openedAt: string;
    actualDose: number;
    isRefund: boolean;
    operator?: string;
    notes?: string;
}
export interface ManualCorrection {
    id: string;
    date: string;
    type: 'dose_adjustment' | 'refund_confirm' | 'batch_merge' | 'other';
    appointmentId?: string;
    batchNumber?: string;
    reason: string;
    originalValue?: string;
    correctedValue?: string;
    operator: string;
    createdAt: string;
}
export interface ReconciliationResult {
    date: string;
    totalAppointments: number;
    reconciled: number;
    pending: number;
    issues: ReconciliationIssue[];
    batchSummary: BatchSummary[];
    manualCorrections: ManualCorrection[];
}
export interface ReconciliationIssue {
    type: 'missing_usage' | 'excess_usage' | 'refund_mismatch' | 'batch_invalid' | 'duplicate_usage';
    appointmentId?: string;
    batchNumber?: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}
export interface BatchSummary {
    batchNumber: string;
    contrastAgent: string;
    totalVolume: number;
    usedVolume: number;
    refundedVolume: number;
    remainingVolume: number;
    issue?: string;
}
export interface DailyReport {
    date: string;
    generatedAt: string;
    appointmentStats: {
        total: number;
        completed: number;
        pending: number;
        refunded: number;
    };
    batchStats: BatchSummary[];
    issues: ReconciliationIssue[];
    manualCorrections: ManualCorrection[];
    reconciliationStatus: 'complete' | 'pending' | 'has_errors';
}
export type ImportDataType = 'appointments' | 'batches' | 'usage';
export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: ImportError[];
    warnings: string[];
}
export interface ImportError {
    row?: number;
    field?: string;
    value?: string;
    message: string;
}
