import * as fs from 'fs';
import * as yaml from 'yaml';
import { SamplingRule, SamplingCondition } from '../model/types';

export class SamplingRulesParser {
  parseFile(filePath: string): SamplingRule[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.parse(content);
    return this.normalizeRules(data);
  }

  private normalizeRules(data: Record<string, unknown>): SamplingRule[] {
    const rules: SamplingRule[] = [];
    const rulesData = Array.isArray(data.rules) ? data.rules : [data];

    for (const rule of rulesData) {
      if (!rule) continue;
      rules.push({
        name: rule.name as string || 'unnamed-rule',
        type: this.normalizeType(rule.type as string),
        conditions: this.normalizeConditions(rule.conditions as Record<string, unknown>[]),
        action: rule.action === 'drop' ? 'drop' : 'keep',
        probability: rule.probability as number,
        rateLimit: rule.rateLimit as number || rule.rate_limit as number,
        errorsOnly: rule.errorsOnly as boolean || rule.errors_only as boolean,
        latencyThreshold: rule.latencyThreshold as number || rule.latency_threshold as number,
      });
    }

    return rules;
  }

  private normalizeType(type: string): 'head' | 'tail' {
    if (type === 'tail' || type === 'TailSampling') return 'tail';
    return 'head';
  }

  private normalizeConditions(conditions: Record<string, unknown>[] | undefined): SamplingCondition[] {
    if (!conditions) return [];
    return conditions.map(c => ({
      attribute: c.attribute as string || c.key as string,
      operator: this.normalizeOperator(c.operator as string),
      value: c.value as unknown,
    }));
  }

  private normalizeOperator(op: string): SamplingCondition['operator'] {
    const opMap: Record<string, SamplingCondition['operator']> = {
      '==': 'eq', 'eq': 'eq', 'equals': 'eq',
      '!=': 'neq', 'neq': 'neq', 'not_equals': 'neq',
      '>': 'gt', 'gt': 'gt',
      '<': 'lt', 'lt': 'lt',
      '>=': 'gte', 'gte': 'gte', 'gteq': 'gte',
      '<=': 'lte', 'lte': 'lte', 'lteq': 'lte',
      'contains': 'contains',
      'exists': 'exists',
    };
    return opMap[op] || 'eq';
  }
}