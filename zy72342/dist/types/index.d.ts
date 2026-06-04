export type UserRole = 'teacher' | 'assistant' | 'admin';
export interface User {
    id: string;
    name: string;
    role: UserRole;
}
export interface SurveyRawRow {
    id: string;
    questionId: string;
    questionText: string;
    respondentId: string;
    respondentName: string;
    answer: string;
    answerValue: number;
    mainProcess: string;
    timestamp: string;
    importedBy: string;
    importedAt: string;
}
export interface BoundaryNote {
    id: string;
    questionId: string;
    respondentId?: string;
    fieldStatement: string;
    threshold: number;
    operator: '>' | '<' | '>=' | '<=' | '==';
    notedBy: string;
    notedAt: string;
    supplementary?: string;
}
export type EvidenceType = 'main_process' | 'field_statement' | 'both';
export interface FilterResult {
    id: string;
    questionId: string;
    respondentId: string;
    respondentName: string;
    questionText: string;
    answer: string;
    answerValue: number;
    mutualInfoScore: number;
    threshold: number;
    isAtThreshold: boolean;
    evidenceType: EvidenceType;
    mainProcessEvidence: string;
    fieldStatementEvidence?: string;
    status: 'normal' | 'pending_review' | 'anomaly' | 'resolved';
    decidedBy?: string;
    decidedAt?: string;
    decisionNote?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CounterExample {
    id: string;
    filterResultId: string;
    questionId: string;
    respondentId: string;
    respondentName: string;
    reasonKept: string;
    missingMaterials: string[];
    nextAction: 'contact_teacher' | 'contact_assistant' | 'collect_more' | 'resolved';
    nextHandler: string;
    status: 'open' | 'in_progress' | 'resolved';
    evidence: {
        mainProcess?: string;
        fieldStatement?: string;
    };
    createdAt: string;
    updatedAt: string;
}
export interface AuditLog {
    id: string;
    entityType: 'survey_row' | 'boundary_note' | 'filter_result' | 'counter_example' | 'filter_run';
    entityId: string;
    action: 'import' | 'create' | 'update' | 'delete' | 'decide' | 're_run';
    actor: string;
    actorRole: UserRole;
    changeDescription: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    impactResults?: string[];
    reason: string;
    timestamp: string;
}
export interface FilterConfig {
    threshold: number;
    autoResolveAbove: boolean;
    requireReviewAtThreshold: boolean;
    defaultHandlerForPending: string;
}
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export interface FilterRun {
    id: string;
    startedAt: string;
    completedAt?: string;
    status: RunStatus;
    triggeredBy: string;
    config: FilterConfig;
    surveyRowIds: string[];
    boundaryNoteIds: string[];
    resultCount: number;
    anomalyCount: number;
    pendingCount: number;
}
export interface DemoData {
    users: User[];
    surveyRows: SurveyRawRow[];
    boundaryNotes: BoundaryNote[];
    auditLogs: AuditLog[];
    filterRuns: FilterRun[];
    results: FilterResult[];
    counterExamples: CounterExample[];
}
