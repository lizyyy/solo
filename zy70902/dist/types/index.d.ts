export interface MaintenanceRecord {
    id: string;
    cableCarId: string;
    maintenanceDate: string;
    maintenanceType: string;
    items: MaintenanceItem[];
    inspector: string;
    remarks?: string;
    source: 'csv';
    importedAt: string;
}
export interface MaintenanceItem {
    itemCode: string;
    itemName: string;
    isKeyItem: boolean;
    inspectionResult: 'pass' | 'fail' | 'na';
    signedBy?: string;
    signedAt?: string;
}
export interface SensorData {
    id: string;
    cableCarId: string;
    sensorType: string;
    sensorId: string;
    readings: SensorReading[];
    trialRunDuration?: number;
    trialRunPassed?: boolean;
    collectedAt: string;
    source: 'json';
    importedAt: string;
}
export interface SensorReading {
    timestamp: string;
    value: number;
    unit: string;
    status: 'normal' | 'warning' | 'error';
}
export interface ApprovalRecord {
    id: string;
    cableCarId: string;
    approvalType: 'trial_run' | 'release';
    applicant: string;
    approver?: string;
    approvedAt?: string;
    status: 'pending' | 'approved' | 'rejected';
    validFrom?: string;
    validTo?: string;
    remarks?: string;
    source: 'csv' | 'json';
    importedAt: string;
}
export type DiffType = 'trial_run_insufficient' | 'key_item_unsigned' | 'overdue_release' | 'maintenance_fail' | 'sensor_abnormal' | 'approval_missing' | 'approval_pending';
export interface DiffDetail {
    id: string;
    type: DiffType;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    cableCarId: string;
    relatedRecords: {
        type: 'maintenance' | 'sensor' | 'approval';
        id: string;
        field?: string;
    }[];
    status: 'open' | 'confirmed' | 'resolved';
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNotes?: string;
}
export interface ReconciliationResult {
    id: string;
    batchId: string;
    createdAt: string;
    totalCableCars: number;
    passedCount: number;
    failedCount: number;
    diffs: DiffDetail[];
    summary: ReconciliationSummary;
}
export interface ReconciliationSummary {
    totalDiffs: number;
    byType: Record<DiffType, number>;
    bySeverity: {
        high: number;
        medium: number;
        low: number;
    };
    trialRunIssues: number;
    unsignedKeyItems: number;
    overdueReleases: number;
    passRate: number;
}
export interface ReviewRecord {
    id: string;
    diffId: string;
    reviewer: string;
    action: 'confirm' | 'resolve' | 'dismiss';
    notes?: string;
    reviewedAt: string;
}
export interface ReportData {
    id: string;
    batchId: string;
    generatedAt: string;
    generatedBy: string;
    period: {
        start: string;
        end: string;
    };
    summary: ReconciliationSummary;
    diffs: DiffDetail[];
    traceability: TraceabilityRecord[];
}
export interface TraceabilityRecord {
    cableCarId: string;
    maintenanceRecordId?: string;
    sensorDataId?: string;
    approvalRecordId?: string;
    diffIds: string[];
    finalStatus: 'pass' | 'fail' | 'warning';
}
export interface BatchImportResult {
    batchId: string;
    importedAt: string;
    maintenanceCount: number;
    sensorCount: number;
    approvalCount: number;
}
