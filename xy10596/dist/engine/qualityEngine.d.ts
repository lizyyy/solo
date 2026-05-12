import { SurveyRecord, QualityRule, RejectReason } from '../types';
export interface QualityCheckResult {
    passed: boolean;
    reasons: RejectReason[];
    details: Record<string, any>;
}
export declare class QualityEngine {
    private rules;
    constructor(rules: QualityRule[]);
    check(survey: SurveyRecord, allSurveys: SurveyRecord[]): QualityCheckResult;
    private applyRule;
    private checkDuplicatePhone;
    private checkMinDuration;
    private checkAllSameOptions;
    static processWithQualityCheck(survey: SurveyRecord, allSurveys: SurveyRecord[], engine: QualityEngine): SurveyRecord;
}
