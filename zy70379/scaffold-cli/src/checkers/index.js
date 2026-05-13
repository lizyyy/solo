const PackageChecker = require('./package-checker');
const DockerfileChecker = require('./dockerfile-checker');
const HealthcheckChecker = require('./healthcheck-checker');
const LoggingChecker = require('./logging-checker');
const StructureChecker = require('./structure-checker');
const config = require('../config');

class CheckerManager {
  constructor(templateLoader, options = {}) {
    this.templateLoader = templateLoader;
    this.options = options;
    this.rules = options.rules || Object.keys(config.RULE_DEFINITIONS);
  }

  scanProject(projectPath) {
    const template = this.templateLoader.loadProjectTemplate(projectPath);
    const allIssues = [];

    if (this.shouldCheckRule('template-version') || this.shouldCheckRule('package-scripts') ||
        this.shouldCheckRule('node-version') || this.shouldCheckRule('dependency-version')) {
      const checker = new PackageChecker(template, projectPath, this.templateLoader);
      const issues = checker.check();
      allIssues.push(...issues.filter(i => this.shouldCheckRule(i.ruleId)));
    }

    if (this.shouldCheckRule('dockerfile') || this.shouldCheckRule('healthcheck') ||
        this.shouldCheckRule('required-files')) {
      const checker = new DockerfileChecker(template, projectPath);
      const issues = checker.check();
      allIssues.push(...issues.filter(i => this.shouldCheckRule(i.ruleId)));
    }

    if (this.shouldCheckRule('healthcheck')) {
      const checker = new HealthcheckChecker(template, projectPath);
      allIssues.push(...checker.check());
    }

    if (this.shouldCheckRule('logging')) {
      const checker = new LoggingChecker(template, projectPath);
      allIssues.push(...checker.check());
    }

    if (this.shouldCheckRule('directory-structure') || this.shouldCheckRule('required-files')) {
      const checker = new StructureChecker(template, projectPath);
      const issues = checker.check();
      allIssues.push(...issues.filter(i => this.shouldCheckRule(i.ruleId)));
    }

    return {
      projectPath,
      template: {
        name: template.name,
        version: template.version,
        description: template.description
      },
      issues: this.deduplicateIssues(allIssues),
      scannedAt: new Date().toISOString()
    };
  }

  shouldCheckRule(ruleId) {
    return this.rules.includes(ruleId) || this.rules.includes('all');
  }

  deduplicateIssues(issues) {
    const seen = new Set();
    const unique = [];

    for (const issue of issues) {
      const key = this.getIssueKey(issue);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(issue);
      }
    }

    return unique;
  }

  getIssueKey(issue) {
    const parts = [issue.ruleId];
    if (issue.details?.mismatchedScript) parts.push(issue.details.mismatchedScript);
    if (issue.details?.missingFile) parts.push(issue.details.missingFile);
    if (issue.details?.missingDirectory) parts.push(issue.details.missingDirectory);
    if (issue.details?.dependency) parts.push(issue.details.dependency);
    if (issue.details?.configKey) parts.push(issue.details.configKey);
    return parts.join('::');
  }
}

module.exports = CheckerManager;
