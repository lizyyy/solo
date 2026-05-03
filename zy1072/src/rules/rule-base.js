import { CONFLICT_SEVERITY, CONFLICT_TYPES } from '../types.js';

export class RuleBase {
  constructor(name, description, severity = CONFLICT_SEVERITY.MEDIUM) {
    this.name = name;
    this.description = description;
    this.severity = severity;
    this.enabled = true;
  }

  async execute(context) {
    if (!this.enabled) {
      return { rule: this.name, conflicts: [] };
    }
    try {
      const conflicts = await this.validate(context);
      return { rule: this.name, conflicts };
    } catch (error) {
      return {
        rule: this.name,
        conflicts: [{
          type: 'rule_error',
          severity: CONFLICT_SEVERITY.HIGH,
          message: `规则执行错误: ${error.message}`
        }]
      };
    }
  }

  async validate(context) {
    throw new Error('子类必须实现 validate 方法');
  }

  createConflict(conflictType, message, details = {}) {
    return {
      rule: this.name,
      type: conflictType,
      severity: this.severity,
      message,
      timestamp: new Date().toISOString(),
      ...details
    };
  }
}
