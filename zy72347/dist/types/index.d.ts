export type ValueFormat = 'percentage' | 'decimal' | 'mixed' | 'unknown';
export type ProcessingStatus = 'imported' | 'detected_mixed' | 'pending_review' | 'reviewed' | 'approved' | 'rejected' | 'normalized' | 'completed' | 'rolled_back';
export type WorkflowStep = 'import' | 'annotation' | 'update';
export interface RawValue {
    original: string;
    numericValue: number;
    format: ValueFormat;
}
export interface ChangeRecord {
    id: string;
    timestamp: number;
    operator: string;
    field: string;
    oldValue: string;
    newValue: string;
    reason: string;
    rollbackAvailable: boolean;
}
export interface AnnotationRecord {
    id: string;
    timestamp: number;
    author: string;
    content: string;
    screenshotRef?: string;
}
export interface DataRecord {
    id: string;
    originalRowNumber: number;
    sourceFile: string;
    importTimestamp: number;
    importedBy: string;
    rawValues: Map<string, RawValue>;
    normalizedValues: Map<string, number>;
    status: ProcessingStatus;
    currentStep: WorkflowStep;
    formatDetected: ValueFormat;
    hasMixedFormat: boolean;
    changeHistory: ChangeRecord[];
    annotations: AnnotationRecord[];
    reviewAssignee?: string;
    reviewDecision?: 'approve' | 'reject' | 'rollback';
    reviewTimestamp?: number;
    completedBy?: string;
    completedTimestamp?: number;
}
export interface BoundaryRule {
    id: string;
    name: string;
    description: string;
    condition: (record: DataRecord) => boolean;
    action: 'flag_for_review' | 'auto_normalize' | 'reject' | 'rollback';
    severity: 'info' | 'warning' | 'error';
}
export interface WorkflowConfig {
    requireReviewForMixedFormat: boolean;
    autoNormalizeDecimal: boolean;
    autoNormalizePercentage: boolean;
    rollbackWindowHours: number;
    reviewers: string[];
}
export interface ProcessingResult<T> {
    success: boolean;
    data?: T;
    errors: string[];
    warnings: string[];
}
export interface AuditLogEntry {
    id: string;
    timestamp: number;
    operator: string;
    action: string;
    recordId?: string;
    details: Record<string, unknown>;
}
export interface ReplaySession {
    sessionId: string;
    startTime: number;
    endTime?: number;
    commands: string[];
    results: ProcessingResult<unknown>[];
}
