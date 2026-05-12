import { SurveyRecord, QuotaRule, QuotaUsage } from '../types';
export interface QuotaCheckResult {
    passed: boolean;
    overQuota: boolean;
    overQuotaRules: string[];
    details: Record<string, any>;
}
export declare class QuotaEngine {
    private rules;
    constructor(rules: QuotaRule[]);
    static initializeQuotaUsage(rules: QuotaRule[]): QuotaUsage[];
    static calculateQuotaUsage(rules: QuotaRule[], surveys: SurveyRecord[]): QuotaUsage[];
    check(survey: SurveyRecord, quotaUsage: QuotaUsage[]): QuotaCheckResult;
    static matchesRule(survey: SurveyRecord, rule: QuotaRule): boolean;
    static processWithQuotaCheck(survey: SurveyRecord, quotaUsage: QuotaUsage[], engine: QuotaEngine): SurveyRecord;
    static getRulesForSurvey(survey: SurveyRecord, rules: QuotaRule[]): QuotaRule[];
}
