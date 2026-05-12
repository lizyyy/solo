import { SurveyRecord, QualityRule, RejectReason, SurveyStatus } from '../types';
import { HistoryManager } from '../utils/history';

export interface QualityCheckResult {
  passed: boolean;
  reasons: RejectReason[];
  details: Record<string, any>;
}

export class QualityEngine {
  private rules: QualityRule[];

  constructor(rules: QualityRule[]) {
    this.rules = rules.filter(r => r.enabled);
  }

  check(
    survey: SurveyRecord,
    allSurveys: SurveyRecord[]
  ): QualityCheckResult {
    const reasons: RejectReason[] = [];
    const details: Record<string, any> = {};

    for (const rule of this.rules) {
      const result = this.applyRule(rule, survey, allSurveys);
      if (!result.passed) {
        reasons.push(...result.reasons);
        details[rule.id] = result.details;
      }
    }

    return {
      passed: reasons.length === 0,
      reasons,
      details
    };
  }

  private applyRule(
    rule: QualityRule,
    survey: SurveyRecord,
    allSurveys: SurveyRecord[]
  ): QualityCheckResult {
    switch (rule.type) {
      case 'duplicate_phone':
        return this.checkDuplicatePhone(survey, allSurveys, rule);
      case 'min_duration':
        return this.checkMinDuration(survey, rule);
      case 'all_same_options':
        return this.checkAllSameOptions(survey, rule);
      case 'custom':
        return { passed: true, reasons: [], details: {} };
      default:
        return { passed: true, reasons: [], details: {} };
    }
  }

  private checkDuplicatePhone(
    survey: SurveyRecord,
    allSurveys: SurveyRecord[],
    rule: QualityRule
  ): QualityCheckResult {
    const duplicates = allSurveys.filter(
      s => 
        s.id !== survey.id &&
        s.phone === survey.phone &&
        (s.status === SurveyStatus.VALID || s.status === SurveyStatus.MANUALLY_RESERVED)
    );

    if (duplicates.length > 0) {
      return {
        passed: false,
        reasons: [RejectReason.DUPLICATE_PHONE],
        details: {
          rule: rule.name,
          duplicateCount: duplicates.length,
          duplicateIds: duplicates.map(d => d.id)
        }
      };
    }

    return { passed: true, reasons: [], details: {} };
  }

  private checkMinDuration(
    survey: SurveyRecord,
    rule: QualityRule
  ): QualityCheckResult {
    const minDuration = rule.config.minSeconds || 60;
    
    if (survey.duration < minDuration) {
      return {
        passed: false,
        reasons: [RejectReason.TOO_FAST],
        details: {
          rule: rule.name,
          expected: minDuration,
          actual: survey.duration
        }
      };
    }

    return { passed: true, reasons: [], details: {} };
  }

  private checkAllSameOptions(
    survey: SurveyRecord,
    rule: QualityRule
  ): QualityCheckResult {
    const answers = Object.values(survey.answers);
    if (answers.length < 3) {
      return { passed: true, reasons: [], details: {} };
    }

    const firstAnswer = JSON.stringify(answers[0]);
    const allSame = answers.every(a => JSON.stringify(a) === firstAnswer);

    if (allSame) {
      return {
        passed: false,
        reasons: [RejectReason.ALL_SAME_OPTIONS],
        details: {
          rule: rule.name,
          totalQuestions: answers.length,
          sameValue: firstAnswer
        }
      };
    }

    return { passed: true, reasons: [], details: {} };
  }

  static processWithQualityCheck(
    survey: SurveyRecord,
    allSurveys: SurveyRecord[],
    engine: QualityEngine
  ): SurveyRecord {
    const result = engine.check(survey, allSurveys);
    
    if (!result.passed) {
      return HistoryManager.addToRecord(
        survey,
        '质量检查',
        SurveyStatus.REJECTED,
        'system',
        {
          reason: `质量检查失败: ${result.reasons.join(', ')}`,
          details: result.details
        }
      );
    }

    return HistoryManager.addToRecord(
      survey,
      '质量检查',
      SurveyStatus.PENDING,
      'system',
      {
        reason: '质量检查通过，等待配额检查',
        details: result.details
      }
    );
  }
}
