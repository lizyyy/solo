import { CONFLICT_SEVERITY } from '../types.js';
import { RuleBase } from './rule-base.js';
import { DuplicateNameRule, MissingTableRule, UnseatedGuestRule } from './validation-rules.js';
import { TableCapacityRule, EmptyTableRule } from './table-rules.js';
import { CompanionsSeparatedRule, AvoidConflictRule, PreferWithRule } from './relation-rules.js';
import { AccessibilityRule, ChildrenTableRule, QuietZoneRule } from './position-rules.js';
import { VIPSeatingRule, DietarySummaryRule, GroupSeatingRule } from './special-rules.js';

const SEVERITY_ORDER = {
  [CONFLICT_SEVERITY.CRITICAL]: 0,
  [CONFLICT_SEVERITY.HIGH]: 1,
  [CONFLICT_SEVERITY.MEDIUM]: 2,
  [CONFLICT_SEVERITY.LOW]: 3
};

export class RuleEngine {
  constructor(options = {}) {
    this.rules = [];
    this.options = {
      includeInfoRules: true,
      ...options
    };
    this._registerDefaultRules();
  }

  _registerDefaultRules() {
    const validationRules = [
      new DuplicateNameRule(),
      new MissingTableRule(),
      new UnseatedGuestRule()
    ];

    const tableRules = [
      new TableCapacityRule(),
      new EmptyTableRule()
    ];

    const relationRules = [
      new CompanionsSeparatedRule(),
      new AvoidConflictRule(),
      new PreferWithRule()
    ];

    const positionRules = [
      new AccessibilityRule(),
      new ChildrenTableRule(),
      new QuietZoneRule()
    ];

    const specialRules = [
      new VIPSeatingRule(),
      new DietarySummaryRule(),
      new GroupSeatingRule()
    ];

    this.rules = [
      ...validationRules,
      ...tableRules,
      ...relationRules,
      ...positionRules,
      ...specialRules
    ];
  }

  addRule(rule) {
    if (rule instanceof RuleBase) {
      this.rules.push(rule);
    }
    return this;
  }

  async validate(context) {
    const { guests, tables, parseErrors = [] } = context;
    const allResults = [];
    const allConflicts = [];

    for (const rule of this.rules) {
      try {
        const result = await rule.execute({ guests, tables });
        allResults.push(result);
        allConflicts.push(...result.conflicts);
      } catch (error) {
        allConflicts.push({
          rule: rule.name,
          type: 'rule_error',
          severity: CONFLICT_SEVERITY.HIGH,
          message: `规则执行失败: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    const sortedConflicts = this._sortConflicts(allConflicts);
    const summary = this._generateSummary(sortedConflicts, parseErrors);

    return {
      results: allResults,
      conflicts: sortedConflicts,
      parseErrors,
      summary,
      hasCritical: sortedConflicts.some(c => c.severity === CONFLICT_SEVERITY.CRITICAL),
      hasHigh: sortedConflicts.some(c => c.severity === CONFLICT_SEVERITY.HIGH),
      stats: this._getStats(sortedConflicts)
    };
  }

  _sortConflicts(conflicts) {
    return [...conflicts].sort((a, b) => {
      const orderA = SEVERITY_ORDER[a.severity] ?? 4;
      const orderB = SEVERITY_ORDER[b.severity] ?? 4;
      return orderA - orderB;
    });
  }

  _getStats(conflicts) {
    const stats = {
      [CONFLICT_SEVERITY.CRITICAL]: 0,
      [CONFLICT_SEVERITY.HIGH]: 0,
      [CONFLICT_SEVERITY.MEDIUM]: 0,
      [CONFLICT_SEVERITY.LOW]: 0,
      total: conflicts.length
    };

    for (const conflict of conflicts) {
      if (stats[conflict.severity] !== undefined) {
        stats[conflict.severity]++;
      }
    }

    return stats;
  }

  _generateSummary(conflicts, parseErrors) {
    const stats = this._getStats(conflicts);
    const totalIssues = stats.total + parseErrors.length;

    let status = 'pass';
    let messages = [];

    if (parseErrors.length > 0) {
      messages.push(`解析错误: ${parseErrors.length} 项`);
      status = 'error';
    }

    if (stats[CONFLICT_SEVERITY.CRITICAL] > 0) {
      messages.push(`严重冲突: ${stats[CONFLICT_SEVERITY.CRITICAL]} 项 - 必须修复`);
      status = 'critical';
    }

    if (stats[CONFLICT_SEVERITY.HIGH] > 0) {
      messages.push(`高优先级冲突: ${stats[CONFLICT_SEVERITY.HIGH]} 项 - 建议修复`);
      if (status === 'pass') status = 'warning';
    }

    if (stats[CONFLICT_SEVERITY.MEDIUM] > 0) {
      messages.push(`中等优先级冲突: ${stats[CONFLICT_SEVERITY.MEDIUM]} 项 - 可择机修复`);
    }

    if (stats[CONFLICT_SEVERITY.LOW] > 0) {
      messages.push(`信息提示: ${stats[CONFLICT_SEVERITY.LOW]} 项 - 仅供参考`);
    }

    if (totalIssues === 0) {
      messages.push('所有检查通过！无发现冲突或错误。');
    }

    return {
      status,
      totalIssues,
      messages,
      stats
    };
  }
}

export default RuleEngine;
