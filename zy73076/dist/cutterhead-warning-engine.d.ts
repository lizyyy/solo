import { InspectionRecord, ThresholdRule, WarningDetail, WarningResultSet, WarningStatistics, FilterCriteria, AnomalyQueueItem, JudgmentChange, DuplicateIdConfirmation } from './types';
import { EquipmentNormalizer } from './equipment-normalizer';
export declare class CutterheadWarningEngine {
    private normalizer;
    private rules;
    private previousJudgments;
    constructor(normalizer: EquipmentNormalizer, rules?: ThresholdRule[], previousJudgments?: WarningDetail[]);
    setRules(rules: ThresholdRule[]): void;
    generate(inspections: InspectionRecord[], criteria?: FilterCriteria): WarningResultSet;
    private findRule;
    private evaluateLevel;
    private buildThresholdBreach;
    private buildDuplicateConfirmations;
    private buildAnomalyQueue;
    private buildJudgmentChanges;
    applyFullFilter(details: WarningDetail[], queue: AnomalyQueueItem[], confirmations: DuplicateIdConfirmation[], changes: JudgmentChange[], criteria: FilterCriteria): {
        details: WarningDetail[];
        queue: AnomalyQueueItem[];
        confirmations: DuplicateIdConfirmation[];
        changes: JudgmentChange[];
    };
    computeStatistics(details: WarningDetail[], queue: AnomalyQueueItem[], criteria: FilterCriteria): WarningStatistics;
    private levelLabel;
    private describeEquipmentIssue;
    private describeSuspension;
    private buildReviewRemark;
}
