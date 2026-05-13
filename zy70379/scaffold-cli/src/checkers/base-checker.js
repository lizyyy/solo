const config = require('../config');

class BaseChecker {
  constructor(template, projectPath) {
    this.template = template;
    this.projectPath = projectPath;
  }

  getRuleDefinition(ruleId) {
    return config.getRuleDefinition(ruleId);
  }

  createIssue(ruleId, message, details = {}) {
    const ruleDef = this.getRuleDefinition(ruleId);
    return {
      id: `${ruleId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      ruleName: ruleDef?.name || ruleId,
      severity: ruleDef?.severity || 'medium',
      category: ruleDef?.category || 'general',
      message,
      details,
      fixSuggestion: ruleDef?.fixSuggestion || '请参考模板进行修正',
      template: {
        version: this.template.version,
        name: this.template.name
      }
    };
  }

  check() {
    throw new Error('Subclasses must implement check() method');
  }
}

module.exports = BaseChecker;
