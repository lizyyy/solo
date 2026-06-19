export type MaterialSource = 'normal' | 'wrong-caliber' | 'supplement';
export type WorkflowStep = 'alias-import' | 'photo-review' | 'checklist-update';
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';
export type LeaveReviewStatus = 'pending' | 'reviewed-by-coordinator';
export type VerificationResult = 'match' | 'conflict' | 'pending-review';
export interface TrackAlias {
    id: string;
    canonicalName: string;
    aliases: string[];
    copyrightHolder: string;
    lastUpdated: Date;
    source: MaterialSource;
}
export interface ClassSessionPhoto {
    id: string;
    sessionDate: Date;
    performerId: string;
    performerName: string;
    locationId: string;
    locationName: string;
    trackName: string;
    isLeave: boolean;
    leaveReason?: string;
    photoUrl: string;
    uploadedAt: Date;
    source: MaterialSource;
    supplementNote?: string;
}
export interface ScheduleRecord {
    id: string;
    sessionDate: Date;
    performerId: string;
    performerName: string;
    locationId: string;
    locationName: string;
    trackName: string;
    canonicalTrackName?: string;
    isConsumed: boolean;
    isLeave: boolean;
    consumedHours: number;
    source: MaterialSource;
    importBatchId: string;
    createdAt: Date;
    updatedAt: Date;
}
export type ConflictResolveAction = 'deer-confirmed' | 'deer-rejected' | 'coordinator-reviewed' | 'auto-fixed' | 'supplement-recalculated';
export interface ConflictResolution {
    action: ConflictResolveAction;
    operator: string;
    timestamp: Date;
    judgment: string;
    finalConclusion: string;
}
export interface TrackChecklistItem {
    id: string;
    sessionDate: Date;
    performerId: string;
    performerName: string;
    locationId: string;
    locationName: string;
    trackNameFromPhoto: string;
    trackNameFromAlias: string;
    canonicalTrackName?: string;
    verificationResult: VerificationResult;
    conflictEvidence?: ConflictEvidence;
    conflictId?: string;
    originalConflictType?: ConflictEvidence['type'];
    originalConflictDescription?: string;
    originalConflictSuggestion?: string;
    originalPhotoEvidence?: ConflictEvidence['photoEvidence'];
    originalAliasEvidence?: ConflictEvidence['aliasEvidence'];
    originalScheduleEvidence?: ConflictEvidence['scheduleEvidence'];
    conflictTriggerAction?: string;
    conflictNeedsCoordinatorReview?: boolean;
    conflictResolution?: ConflictResolution;
    isLeave: boolean;
    leaveReviewStatus: LeaveReviewStatus;
    reviewedBy?: string;
    reviewedAt?: Date;
    source: MaterialSource;
}
export interface ConflictEvidence {
    id: string;
    type: 'track-name-mismatch' | 'leave-counted-as-consumed' | 'duplicate-import';
    description: string;
    photoEvidence: {
        trackName: string;
        isLeave: boolean;
        photoUrl: string;
    };
    aliasEvidence: {
        canonicalName: string;
        aliases: string[];
        copyrightHolder: string;
    };
    scheduleEvidence?: {
        isConsumed: boolean;
        consumedHours: number;
        isLeave: boolean;
    };
    suggestion: string;
    needsCoordinatorReview: boolean;
}
export interface SelfCheckItem {
    id: string;
    checkType: 'duplicate-import' | 'leave-counted-as-consumed' | 'supplement-recalculate' | 'export-consistency';
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details: string;
    affectedRecords: string[];
}
export interface SelfCheckReport {
    checkTime: Date;
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    items: SelfCheckItem[];
}
export interface WorkflowState {
    currentStep: WorkflowStep;
    batchId: string;
    source: MaterialSource;
    aliasImported: boolean;
    photosReviewed: boolean;
    checklistUpdated: boolean;
    pendingConflicts: ConflictEvidence[];
    pendingLeaveReviews: TrackChecklistItem[];
    messages: UserMessage[];
}
export interface UserMessage {
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    suggestion?: string;
    timestamp: Date;
}
export interface ImportResult<T> {
    success: boolean;
    imported: T[];
    reused: T[];
    duplicates: T[];
    errors: UserMessage[];
    warnings: UserMessage[];
    batchId: string;
}
export interface AuditEntry {
    id: string;
    entityType: 'checklist-item' | 'schedule-record' | 'track-alias';
    entityId: string;
    action: 'create' | 'update' | 'conflict-resolve' | 'leave-review' | 'auto-fix';
    before: Record<string, any> | null;
    after: Record<string, any>;
    operator: string;
    timestamp: Date;
    batchId?: string;
    description: string;
}
export interface ConflictReportEntry {
    conflictId: string;
    checklistItemId: string;
    type: ConflictEvidence['type'];
    source: MaterialSource;
    sourceDescription: string;
    performerName: string;
    sessionDate: Date;
    locationName: string;
    description: string;
    triggerAction: string;
    status: 'pending' | 'confirmed' | 'rejected' | 'reviewed';
    currentStatus: string;
    handledBy?: string;
    handledAt?: Date;
    processingJudgment?: string;
    conclusion?: string;
    suggestion: string;
    needsCoordinatorReview: boolean;
    photoEvidence: {
        trackName: string;
        isLeave: boolean;
        photoUrl: string;
    };
    aliasEvidence: {
        canonicalName: string;
        aliases: string[];
        copyrightHolder: string;
    };
    scheduleEvidence?: {
        isConsumed: boolean;
        consumedHours: number;
        isLeave: boolean;
    };
    historySummary: string[];
    exportRow: Record<string, string>;
}
