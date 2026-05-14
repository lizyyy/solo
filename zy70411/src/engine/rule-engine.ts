import { HandoverItem, Rule, RuleCondition, ValidationResult } from '../types';
import { store } from '../store';

export class RuleEngine {
  private evaluateCondition(item: HandoverItem, condition: RuleCondition): boolean {
    const fieldValue = this.getNestedField(item, condition.field);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'gt':
        return fieldValue > condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
      default:
        return false;
    }
  }

  private getNestedField(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  evaluateItem(item: HandoverItem, rules: Rule[]): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const rule of rules) {
      const allConditionsMet = rule.conditions.every((condition) =>
        this.evaluateCondition(item, condition)
      );

      let passed = true;
      let message = '';

      if (allConditionsMet) {
        switch (rule.action) {
          case 'allow':
            passed = true;
            message = `通过规则: ${rule.name}`;
            break;
          case 'deny':
            passed = false;
            message = `被规则拒绝: ${rule.name}`;
            break;
          case 'review':
            passed = false;
            message = `需要人工审核: ${rule.name}`;
            break;
        }
      } else {
        continue;
      }

      results.push({
        itemId: item.id,
        packageName: item.packageName,
        version: item.version,
        passed,
        ruleId: rule.id,
        ruleVersion: rule.version,
        message,
        details: {
          ruleName: rule.name,
          ruleDescription: rule.description,
          conditions: rule.conditions,
        },
      });
    }

    if (results.length === 0) {
      results.push({
        itemId: item.id,
        packageName: item.packageName,
        version: item.version,
        passed: true,
        ruleId: 'default',
        ruleVersion: 'default',
        message: '默认通过（无匹配规则）',
        details: { note: '未匹配任何规则，使用默认策略通过' },
      });
    }

    return results;
  }

  evaluateBatch(items: HandoverItem[], ruleVersion?: string): {
    passed: ValidationResult[];
    failed: ValidationResult[];
    allResults: ValidationResult[];
  } {
    const rules = ruleVersion
      ? store.getRulesByVersion(ruleVersion)
      : store.getActiveRules();

    const allResults: ValidationResult[] = [];

    for (const item of items) {
      const itemResults = this.evaluateItem(item, rules);
      allResults.push(...itemResults);
    }

    const passed = allResults.filter((r) => r.passed);
    const failed = allResults.filter((r) => !r.passed);

    return { passed, failed, allResults };
  }

  createDefaultRules(): void {
    const rules: Rule[] = [
      {
        id: store.generateId(),
        version: '1.0.0',
        name: '时区偏移检查',
        description: '检查时区偏移是否在合法范围内（-480 到 480 分钟）',
        conditions: [
          { field: 'timezoneOffset', operator: 'gte', value: -480 },
          { field: 'timezoneOffset', operator: 'lte', value: 480 },
        ],
        action: 'deny',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        isActive: true,
      },
      {
        id: store.generateId(),
        version: '1.0.0',
        name: '高风险版本前缀检查',
        description: '拒绝以 alpha、beta、rc 开头的版本号',
        conditions: [
          { field: 'riskLevel', operator: 'eq', value: 'high' },
          { field: 'version', operator: 'regex', value: '^(alpha|beta|rc)' },
        ],
        action: 'deny',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        isActive: true,
      },
      {
        id: store.generateId(),
        version: '1.0.0',
        name: '内部包前缀检查',
        description: '内部包必须以 @internal/ 开头',
        conditions: [
          { field: 'packageName', operator: 'regex', value: '^@internal/' },
        ],
        action: 'allow',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        isActive: true,
      },
      {
        id: store.generateId(),
        version: '1.1.0',
        name: '时区偏移严格检查',
        description: '严格检查时区偏移必须为 -480（北京时间）',
        conditions: [
          { field: 'timezoneOffset', operator: 'ne', value: -480 },
        ],
        action: 'review',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        isActive: true,
      },
      {
        id: store.generateId(),
        version: '1.1.0',
        name: '依赖数量检查',
        description: '依赖超过5个需要审核',
        conditions: [
          { field: 'dependencies.length', operator: 'gt', value: 5 },
        ],
        action: 'review',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        isActive: true,
      },
    ];

    rules.forEach((rule) => store.saveRule(rule));
  }
}

export const ruleEngine = new RuleEngine();
