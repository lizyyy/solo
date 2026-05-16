const LockfileParser = require('./lockfile-parser');
const DependencyComparator = require('./dependency-comparator');
const ReportGenerator = require('./report-generator');

class LicenseDiff {
  constructor(options = {}) {
    this.options = options;
    this.comparator = new DependencyComparator();
    this.reportGenerator = new ReportGenerator();
    this.parserErrors = [];
  }

  run(oldPath, newPath, options = {}) {
    const oldParser = new LockfileParser(oldPath);
    const newParser = new LockfileParser(newPath);
    const oldLock = oldParser.parse();
    const newLock = newParser.parse();
    this.parserErrors = [...oldParser.getErrors(), ...newParser.getErrors()];

    if (!oldLock || !newLock) {
      throw new Error('Cannot parse lockfile');
    }

    const comparison = this.comparator.compare(oldLock, newLock);

    if (options.json) {
      return this.reportGenerator.generateJsonReport(comparison, options.output);
    } else if (options.markdown) {
      return this.reportGenerator.generateMarkdownReport(comparison, options.output);
    } else {
      return this.reportGenerator.generateConsoleReport(comparison);
    }
  }

  parseLockfile(filePath) {
    const parser = new LockfileParser(filePath);
    return parser.parse();
  }

  compareDependencies(oldLock, newLock) {
    return this.comparator.compare(oldLock, newLock);
  }

  generateReport(comparison, format = 'console', outputPath = null) {
    switch (format) {
      case 'json':
        return this.reportGenerator.generateJsonReport(comparison, outputPath);
      case 'markdown':
        return this.reportGenerator.generateMarkdownReport(comparison, outputPath);
      case 'console':
      default:
        return this.reportGenerator.generateConsoleReport(comparison);
    }
  }

  getErrors() {
    return {
      parser: this.parserErrors,
      license: this.comparator.getLicenseErrors()
    };
  }
}

module.exports = LicenseDiff;