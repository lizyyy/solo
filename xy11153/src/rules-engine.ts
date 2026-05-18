import * as fs from 'fs';
import * as path from 'path';
import {
  CourtRecord,
  RulesConfig,
  RuleCondition,
  ClassificationRule,
  SpecialScenarioRule,
  CompensationRule,
} from './types';

export class RulesEngine {
  private config: RulesConfig;

  constructor(rulesPath: string) {
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    this.config = JSON.parse(rulesContent);
  }

  getConfig(): RulesConfig {
    return this.config;
  }

  private evaluateCondition(record: CourtRecord, condition: RuleCondition): boolean {
    const fieldValue = record[condition.field as keyof CourtRecord] || '';
    const valueStr = String(fieldValue);

    switch (condition.operator) {
      case 'equals':
        return condition.values?.some(v => valueStr === v) || false;
      case 'notEquals':
        return condition.values?.every(v => valueStr !== v) || false;
      case 'contains':
        return condition.values?.some(v => valueStr.includes(v)) || false;
      case 'notContains':
        return condition.values?.every(v => !valueStr.includes(v)) || false;
      case 'containsAny':
        return condition.values?.some(v => valueStr.includes(v)) || false;
      case 'startsWith':
        return condition.values?.some(v => valueStr.startsWith(v)) || false;
      case 'endsWith':
        return condition.values?.some(v => valueStr.endsWith(v)) || false;
      case 'isEmpty':
        return valueStr.trim() === '';
      case 'notEmpty':
        return valueStr.trim() !== '';
      case 'matchesPattern':
        return new RegExp(condition.pattern || '').test(valueStr);
      default:
        return false;
    }
  }

  private evaluateRule(
    record: CourtRecord,
    conditions: RuleCondition[],
    matchStrategy: 'all' | 'any'
  ): boolean {
    const results = conditions.map(condition => this.evaluateCondition(record, condition));
    
    if (matchStrategy === 'all') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  isNormalRecord(record: CourtRecord): boolean {
    const rule = this.config.recordClassification.normalRecords;
    return this.evaluateRule(record, rule.conditions, rule.matchStrategy);
  }

  isAbnormalRecord(record: CourtRecord): boolean {
    const rule = this.config.recordClassification.abnormalRecords;
    return this.evaluateRule(record, rule.conditions, rule.matchStrategy);
  }

  isPartialRain(record: CourtRecord): boolean {
    const rule = this.config.specialScenarios.partialRain;
    return this.evaluateRule(record, rule.conditions, rule.matchStrategy);
  }

  isHalfCourtUsage(record: CourtRecord): boolean {
    const rule = this.config.specialScenarios.halfCourtUsage;
    return this.evaluateRule(record, rule.conditions, rule.matchStrategy);
  }

  calculateCompensation(record: CourtRecord): { type: string; rate: number } {
    const fullRule = this.config.compensationRules.fullCompensation;
    if (this.evaluateRule(record, fullRule.conditions, 'any')) {
      return { type: fullRule.compensationType, rate: fullRule.compensationRate };
    }

    const partialRule = this.config.compensationRules.partialCompensation;
    if (this.evaluateRule(record, partialRule.conditions, 'any')) {
      return { type: partialRule.compensationType, rate: partialRule.compensationRate };
    }

    return { type: '无需补偿', rate: 0 };
  }

  processRecord(record: CourtRecord): CourtRecord {
    const processed = { ...record };
    const tags: string[] = [];

    if (this.isPartialRain(record)) {
      tags.push(this.config.specialScenarios.partialRain.tag);
    }

    if (this.isHalfCourtUsage(record)) {
      tags.push(this.config.specialScenarios.halfCourtUsage.tag);
    }

    if (tags.length > 0) {
      processed.标签 = tags.join(';');
    }

    const compensation = this.calculateCompensation(record);
    if (this.isAbnormalRecord(record)) {
      processed.补偿类型 = compensation.type;
      processed.补偿比例 = String(compensation.rate);
    } else {
      processed.补偿类型 = '无需补偿';
      processed.补偿比例 = '0';
    }

    return processed;
  }

  validateRecord(record: CourtRecord, index: number): string[] {
    const warnings: string[] = [];
    const { requiredFields } = this.config.validationRules;

    requiredFields.forEach(field => {
      const value = record[field as keyof CourtRecord];
      if (!value || String(value).trim() === '') {
        warnings.push(`记录 ${index + 1} (${record.预约编号}): 必需字段 "${field}" 为空`);
      }
    });

    return warnings;
  }

  sortRecords(records: CourtRecord[]): CourtRecord[] {
    const sortBy = this.config.outputConfig.sortBy as keyof CourtRecord;
    return [...records].sort((a, b) => {
      const aVal = String(a[sortBy] || '');
      const bVal = String(b[sortBy] || '');
      return aVal.localeCompare(bVal);
    });
  }
}
