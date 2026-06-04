import { SurveyRawRow, BoundaryNote, FilterResult, FilterConfig, EvidenceType, FilterRun } from '../types';
export interface FilterResultWithReason {
    result: Omit<FilterResult, 'id'>;
    reason: string;
}
export declare function determineStatus(score: number, threshold: number, isAtThreshold: boolean, config: FilterConfig, hasFieldEvidence: boolean): {
    status: FilterResult['status'];
    decisionReason: string;
};
export declare function determineEvidenceType(row: SurveyRawRow, notes: BoundaryNote[]): EvidenceType;
export declare function gatherEvidence(row: SurveyRawRow, notes: BoundaryNote[]): {
    evidenceType: EvidenceType;
    mainProcessEvidence: string;
    fieldStatementEvidence?: string;
    matchingNotes: BoundaryNote[];
};
export declare function processRow(row: SurveyRawRow, allRows: SurveyRawRow[], boundaryNotes: BoundaryNote[], config: FilterConfig): FilterResultWithReason;
export interface RunFilterOptions {
    triggeredBy: string;
    configOverrides?: Partial<FilterConfig>;
    surveyRowIds?: string[];
    boundaryNoteIds?: string[];
    existingRunId?: string;
}
export interface RunFilterResult {
    run: FilterRun;
    results: FilterResult[];
    summary: {
        total: number;
        normal: number;
        pendingReview: number;
        anomaly: number;
        withBothEvidence: number;
        withMainProcessOnly: number;
        withFieldStatementOnly: number;
        atThreshold: number;
    };
}
export declare function runFilter(options: RunFilterOptions): RunFilterResult;
export declare function reRunFilter(runId: string, options: Omit<RunFilterOptions, 'existingRunId'>): RunFilterResult;
export declare function decideResult(resultId: string, decision: 'approve_normal' | 'approve_anomaly' | 'escalate', decidedBy: string, decisionNote: string): FilterResult | undefined;
export declare function getResultsAffectedByNote(noteId: string): FilterResult[];
