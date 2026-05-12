export type DefectLevel = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'NONE';
export type InspectionResult = 'PASS' | 'FAIL' | 'REJECT';
export type BatchStatus = 'CREATED' | 'INITIAL_INSPECTION' | 'PENDING_REINSPECTION' | 'REINSPECTION' | 'PENDING_CONCESSION' | 'CONCESSION_APPROVED' | 'PASSED' | 'REJECTED' | 'REWORK' | 'CLOSED';
export type ActionType = 'INITIAL_INSPECT' | 'REINSPECT' | 'REQUEST_CONCESSION' | 'APPROVE_CONCESSION' | 'REJECT_CONCESSION' | 'APPROVE_REWORK' | 'MANUAL_CORRECTION' | 'CLOSE_BATCH';
export interface Defect {
    level: DefectLevel;
    count: number;
    description?: string;
}
export interface InspectionRecord {
    id: string;
    batchId: string;
    sampleCount: number;
    inspectedCount: number;
    defectCount: number;
    defects: Defect[];
    result: InspectionResult;
    inspector: string;
    timestamp: string;
    notes?: string;
}
export interface ConcessionRequest {
    id: string;
    batchId: string;
    reason: string;
    justification: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    requestedBy: string;
    requestedAt: string;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedBy?: string;
    approvedAt?: string;
    approvalNotes?: string;
}
export interface HistoryEntry {
    id: string;
    batchId: string;
    actionType: ActionType;
    previousStatus: BatchStatus;
    newStatus: BatchStatus;
    actor: string;
    timestamp: string;
    reason?: string;
    differences?: {
        field: string;
        oldValue: any;
        newValue: any;
    }[];
    inspectionId?: string;
    concessionId?: string;
}
export interface Batch {
    id: string;
    batchNumber: string;
    productCode: string;
    productName: string;
    quantity: number;
    productionDate: string;
    productionLine: string;
    status: BatchStatus;
    currentRisk: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    inspections: InspectionRecord[];
    concessionRequests: ConcessionRequest[];
    history: HistoryEntry[];
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
}
export interface SamplingSheet {
    id: string;
    batchNumber: string;
    sheetNumber: string;
    sampleCount: number;
    inspectedCount: number;
    defectCount: number;
    defects: Defect[];
    result: InspectionResult;
    inspector: string;
    inspectionDate: string;
    notes?: string;
}
export interface DataStore {
    batches: Record<string, Batch>;
    samplingSheets: Record<string, SamplingSheet>;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface CommandResult<T = void> {
    success: boolean;
    message: string;
    data?: T;
    errors?: string[];
    warnings?: string[];
}
export declare const DEFECT_LEVEL_WEIGHTS: Record<DefectLevel, number>;
export declare const INSPECTION_RULES: {
    MAX_DEFECTS: number;
    REINSPECTION_MULTIPLIER: number;
    CRITICAL_DEFECT_CONCESSION_ONLY: boolean;
    MIN_REINSPECTION_SAMPLE_RATIO: number;
};
