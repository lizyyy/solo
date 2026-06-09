import { InspectionRecord, ThresholdRule, WarningDetail, WarningResultSet, FilterCriteria } from './types';
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
    private buildAnomalyQueue;
    private buildJudgmentChanges;
    private applyFilter;
    private computeStatistics;
    private levelLabel;
    private describeEquipmentIssue;
    private describeSuspension;
    private buildReviewRemark;
}
