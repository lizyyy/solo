class BaseValidator {
  constructor(ruleConfig) {
    this.ruleConfig = ruleConfig
    this.issues = []
  }

  getRuleId() {
    return this.ruleConfig?.ruleId || 'unknown-rule'
  }

  getRuleName() {
    return this.ruleConfig?.name || '未知规则'
  }

  getCategory() {
    return this.ruleConfig?.category || 'general'
  }

  getSeverity() {
    return this.ruleConfig?.severity || 'warning'
  }

  addIssue(options) {
    const issue = {
      ruleId: options.ruleId || this.getRuleId(),
      ruleName: options.ruleName || this.getRuleName(),
      category: options.category || this.getCategory(),
      severity: options.severity || this.getSeverity(),
      title: options.title,
      description: options.description || '',
      suggestion: options.suggestion || '',
      location: options.location || {},
      path: options.path || null,
      method: options.method || null,
      codeExample: options.codeExample || { bad: null, good: null },
      reference: options.reference || this.ruleConfig?.reference || null
    }
    this.issues.push(issue)
    return issue
  }

  async validate(spec, context = {}) {
    throw new Error('validate() must be implemented by subclass')
  }

  getIssues() {
    return [...this.issues]
  }

  clearIssues() {
    this.issues = []
  }
}

module.exports = BaseValidator