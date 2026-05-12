import { SurveyRecord, QuotaRule, QuotaUsage, SurveyStatus, RejectReason } from '../types';
import { HistoryManager } from '../utils/history';

export interface QuotaCheckResult {
  passed: boolean;
  overQuota: boolean;
  overQuotaRules: string[];
  details: Record<string, any>;
}

export class QuotaEngine {
  private rules: QuotaRule[];

  constructor(rules: QuotaRule[]) {
    this.rules = rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  static initializeQuotaUsage(rules: QuotaRule[]): QuotaUsage[] {
    return rules.map(rule => ({
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      criteria: rule.criteria,
      limit: rule.limit,
      used: 0,
      remaining: rule.limit,
      overQuota: 0
    }));
  }

  static calculateQuotaUsage(
    rules: QuotaRule[],
    surveys: SurveyRecord[]
  ): QuotaUsage[] {
    const validSurveys = surveys.filter(
      s => s.status === SurveyStatus.VALID || s.status === SurveyStatus.MANUALLY_RESERVED
    );

    return rules.map(rule => {
      const used = validSurveys.filter(s => this.matchesRule(s, rule)).length;
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        criteria: rule.criteria,
        limit: rule.limit,
        used,
        remaining: Math.max(0, rule.limit - used),
        overQuota: Math.max(0, used - rule.limit)
      };
    });
  }

  check(
    survey: SurveyRecord,
    quotaUsage: QuotaUsage[]
  ): QuotaCheckResult {
    const applicableRules = this.rules.filter(r => QuotaEngine.matchesRule(survey, r));
    
    if (applicableRules.length === 0) {
      return {
        passed: true,
        overQuota: false,
        overQuotaRules: [],
        details: { message: '无匹配的配额规则' }
      };
    }

    const overQuotaRules: string[] = [];
    const details: Record<string, any> = {};

    for (const rule of applicableRules) {
      const usage = quotaUsage.find(u => u.ruleId === rule.id);
      if (usage && usage.remaining <= 0) {
        overQuotaRules.push(rule.name);
        details[rule.id] = {
          ruleName: rule.name,
          limit: usage.limit,
          used: usage.used,
          remaining: usage.remaining
        };
      }
    }

    return {
      passed: overQuotaRules.length === 0,
      overQuota: overQuotaRules.length > 0,
      overQuotaRules,
      details
    };
  }

  static matchesRule(survey: SurveyRecord, rule: QuotaRule): boolean {
    const criteria = rule.criteria;
    
    for (const [key, value] of Object.entries(criteria)) {
      const surveyValue = survey[key as keyof SurveyRecord];
      if (String(surveyValue) !== value) {
        return false;
      }
    }
    
    return true;
  }

  static processWithQuotaCheck(
    survey: SurveyRecord,
    quotaUsage: QuotaUsage[],
    engine: QuotaEngine
  ): SurveyRecord {
    const result = engine.check(survey, quotaUsage);
    
    if (result.overQuota) {
      return HistoryManager.addToRecord(
        survey,
        '配额检查',
        SurveyStatus.OVER_QUOTA,
        'system',
        {
          reason: `配额超限: ${result.overQuotaRules.join(', ')}`,
          details: result.details
        }
      );
    }

    return HistoryManager.addToRecord(
      survey,
      '配额检查',
      SurveyStatus.VALID,
      'system',
      {
        reason: '配额检查通过',
        details: result.details
      }
    );
  }

  static getRulesForSurvey(
    survey: SurveyRecord,
    rules: QuotaRule[]
  ): QuotaRule[] {
    return rules.filter(r => this.matchesRule(survey, r));
  }
}
