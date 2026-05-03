export class BaseValidator {
  constructor(name) {
    this.name = name;
    this.violations = [];
  }

  addViolation(level, category, message, context = {}) {
    this.violations.push({
      validator: this.name,
      level,
      category,
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  isValid() {
    return this.violations.filter(v => v.level === 'error').length === 0;
  }

  hasWarnings() {
    return this.violations.filter(v => v.level === 'warning').length > 0;
  }

  getViolations() {
    return [...this.violations];
  }

  reset() {
    this.violations = [];
  }
}
