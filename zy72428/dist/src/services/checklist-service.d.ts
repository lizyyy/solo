import { TrackChecklistItem, ConflictEvidence, MaterialSource, ConflictReportEntry } from '../types';
export declare class ChecklistService {
    generateChecklist(source?: MaterialSource): {
        checklist: TrackChecklistItem[];
        conflicts: ConflictEvidence[];
        pendingLeaveReviews: TrackChecklistItem[];
    };
    resolveConflict(checklistItemId: string, confirmed: boolean, resolverName: string): TrackChecklistItem | undefined;
    reviewLeaveItem(checklistItemId: string, reviewerName: string): TrackChecklistItem | undefined;
    getConflictReport(): ConflictReportEntry[];
    private buildExportRow;
    getPendingConflictIds(): string[];
    private recordAudit;
    private createMissingAliasConflict;
    private createTrackNameMismatchConflict;
    private createLeaveCountedConflict;
    exportChecklist(source?: MaterialSource): any[];
    private getVerificationResultText;
    private getLeaveReviewStatusText;
    private getSourceText;
}
export declare const checklistService: ChecklistService;
