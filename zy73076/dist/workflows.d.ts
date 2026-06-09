import { WarningResultSet, AnomalyQueueItem, ManagerDashboardView, HandoverPackage, JudgmentChange } from './types';
export declare class ManagerViewBuilder {
    build(resultSet: WarningResultSet): ManagerDashboardView;
    private buildSummaryBreakdown;
    private buildPendingConfirmation;
    private describeFalseStabilityRisk;
    private buildOutstandingGaps;
    private suggestActionFor;
    private levelLabel;
}
export declare class AnomalyQueueWorkflow {
    confirmEquipment(queue: AnomalyQueueItem, operator: string, confirmedCanonicalId: string, comment?: string): AnomalyQueueItem;
    markFalseAlarm(queue: AnomalyQueueItem, operator: string, comment: string): AnomalyQueueItem;
    markResolved(queue: AnomalyQueueItem, operator: string, resolution: string): AnomalyQueueItem;
    transferToAssistant(queue: AnomalyQueueItem, operator: string, handoverDoc: string): AnomalyQueueItem;
    applyAll(queues: AnomalyQueueItem[], updater: (q: AnomalyQueueItem) => AnomalyQueueItem): AnomalyQueueItem[];
}
export declare class JudgmentChangeReporter {
    toInspectionRemarks(changes: JudgmentChange[]): string[];
    toReviewBriefing(changes: JudgmentChange[]): string;
}
export declare class HandoverPackager {
    build(resultSet: WarningResultSet): HandoverPackage;
    private buildChecklist;
}
