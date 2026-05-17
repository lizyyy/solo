const fs = require('fs');

const files = {
  'src/license-normalizer.js': `const spdxParse = require('spdx-expression-parse');

const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown'
};

const LICENSE_RISKS = {
  'GPL-1.0-only': RISK_LEVELS.HIGH,
  'GPL-1.0-or-later': RISK_LEVELS.HIGH,
  'GPL-2.0-only': RISK_LEVELS.HIGH,
  'GPL-2.0-or-later': RISK_LEVELS.HIGH,
  'GPL-3.0-only': RISK_LEVELS.HIGH,
  'GPL-3.0-or-later': RISK_LEVELS.HIGH,
  'AGPL-1.0-only': RISK_LEVELS.HIGH,
  'AGPL-3.0-only': RISK_LEVELS.HIGH,
  'MPL-1.0': RISK_LEVELS.MEDIUM,
  'MPL-1.1': RISK_LEVELS.MEDIUM,
  'MPL-2.0': RISK_LEVELS.MEDIUM,
  'CDDL-1.0': RISK_LEVELS.MEDIUM,
  'EPL-1.0': RISK_LEVELS.MEDIUM,
  'EPL-2.0': RISK_LEVELS.MEDIUM,
  'MIT': RISK_LEVELS.LOW,
  'Apache-2.0': RISK_LEVELS.LOW,
  'BSD-2-Clause': RISK_LEVELS.LOW,
  'BSD-3-Clause': RISK_LEVELS.LOW,
  'ISC': RISK_LEVELS.LOW
};

class LicenseNormalizer {
  constructor() {
    this.errors = [];
  }

  normalize(license, packageName, packagePath) {
    if (!license) {
      this.addError(packageName, 'no license found', packagePath);
      return { original: null, normalized: null, risk: RISK_LEVELS.UNKNOWN };
    }

    const original = license;
    let normalized = license.trim();

    try {
      const parsed = spdxParse(normalized);
      const risk = this.determineRisk(parsed);
      return { original, normalized, risk };
    } catch (e) {
      const risk = this.simpleRiskCheck(normalized);
      this.addError(packageName, 'SPDX parse failed: ' + e.message, packagePath);
      return { original, normalized, risk };
    }
  }

  determineRisk(parsed) {
    if (typeof parsed === 'string') {
      return LICENSE_RISKS[parsed] || RISK_LEVELS.UNKNOWN;
    }
    if (parsed.license) {
      return LICENSE_RISKS[parsed.license] || RISK_LEVELS.UNKNOWN;
    }
    if (parsed.conjunction) {
      const leftRisk = this.riskToNumber(this.determineRisk(parsed.left));
      const rightRisk = this.riskToNumber(this.determineRisk(parsed.right));
      return this.numberToRisk(Math.max(leftRisk, rightRisk));
    }
    return RISK_LEVELS.UNKNOWN;
  }

  simpleRiskCheck(license) {
    const lower = license.toLowerCase();
    if (lower.includes('gpl') || lower.includes('agpl')) return RISK_LEVELS.HIGH;
    if (lower.includes('mpl') || lower.includes('epl') || lower.includes('cddl')) return RISK_LEVELS.MEDIUM;
    if (lower.includes('mit') || lower.includes('apache') || lower.includes('bsd') || lower.includes('isc')) return RISK_LEVELS.LOW;
    return RISK_LEVELS.UNKNOWN;
  }

  riskToNumber(risk) {
    const order = { low: 1, medium: 2, high: 3, unknown: 4 };
    return order[risk] || 4;
  }

  numberToRisk(num) {
    const order = ['low', 'medium', 'high', 'unknown'];
    return order[num - 1] || RISK_LEVELS.UNKNOWN;
  }

  addError(packageName, reason, location) {
    this.errors.push({
      packageName,
      reason,
      location,
      timestamp: new Date().toISOString()
    });
  }

  getErrors() {
    return this.errors;
  }
}

module.exports = LicenseNormalizer;
module.exports.RISK_LEVELS = RISK_LEVELS;
`,

  'src/lockfile-parser.js': `const fs = require('fs');
const path = require('path');
const yarnLockfile = require('@yarnpkg/lockfile');

class LockfileParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.errors = [];
  }

  parse() {
    const content = fs.readFileSync(this.filePath, 'utf8');
    if (this.fileName === 'package-lock.json') return this.parsePackageLock(content);
    if (this.fileName === 'yarn.lock') return this.parseYarnLock(content);
    throw new Error('Unsupported lock file format');
  }

  parsePackageLock(content) {
    try {
      const data = JSON.parse(content);
      const packages = new Map();
      if (data.packages) {
        for (const [pkgPath, pkgInfo] of Object.entries(data.packages)) {
          if (pkgPath === '') continue;
          const name = pkgInfo.name || pkgPath.split('/').pop();
          const version = pkgInfo.version;
          if (!version) { this.addError(name, 'missing version', pkgPath); continue; }
          packages.set(name + '@' + version, { name, version, license: this.extractLicense(pkgInfo), path: pkgPath, dev: pkgInfo.dev || false });
        }
      }
      return { type: 'package-lock', packages: Array.from(packages.values()), errors: this.errors };
    } catch (e) {
      this.addError('root', 'JSON parse failed', '/');
      return { type: 'package-lock', packages: [], errors: this.errors };
    }
  }

  parseYarnLock(content) {
    try {
      const data = yarnLockfile.parse(content);
      const packages = new Map();
      if (data.object) {
        for (const [key, pkgInfo] of Object.entries(data.object)) {
          const name = key.split('@')[0];
          const version = pkgInfo.version;
          if (!version) { this.addError(name, 'missing version', key); continue; }
          packages.set(name + '@' + version, { name, version, license: this.extractLicense(pkgInfo), path: key });
        }
      }
      return { type: 'yarn-lock', packages: Array.from(packages.values()), errors: this.errors };
    } catch (e) {
      this.addError('root', 'Yarn lock file parse failed', '/');
      return { type: 'yarn-lock', packages: [], errors: this.errors };
    }
  }

  extractLicense(pkgInfo) {
    if (pkgInfo.license) return pkgInfo.license;
    if (pkgInfo.licenses) return Array.isArray(pkgInfo.licenses) ? pkgInfo.licenses.map(l => l.type || l).join(' OR ') : (pkgInfo.licenses.type || pkgInfo.licenses);
    return null;
  }

  addError(packageName, reason, location) {
    this.errors.push({ packageName, reason, location, file: this.filePath, timestamp: new Date().toISOString() });
  }
}

module.exports = LockfileParser;
`,

  'src/dependency-comparator.js': `const semver = require('semver');
const LicenseNormalizer = require('./license-normalizer');
const { RISK_LEVELS } = LicenseNormalizer;

class DependencyComparator {
  constructor() {
    this.licenseNormalizer = new LicenseNormalizer();
    this.errors = [];
  }

  compare(oldLockfile, newLockfile) {
    const oldPackages = this.buildPackageMap(oldLockfile.packages);
    const newPackages = this.buildPackageMap(newLockfile.packages);
    const added = [];
    const removed = [];
    const changed = [];
    const unchanged = [];

    for (const [key, newPkg] of newPackages.entries()) {
      const oldPkg = oldPackages.get(key);
      if (!oldPkg) {
        added.push({ ...newPkg, normalizedLicense: this.normalizeLicense(newPkg), changeType: 'added' });
      } else {
        const diff = this.comparePackage(oldPkg, newPkg);
        if (diff.hasChanged) { changed.push(diff); } else { unchanged.push(diff); }
        oldPackages.delete(key);
      }
    }

    for (const [key, oldPkg] of oldPackages.entries()) {
      removed.push({ ...oldPkg, normalizedLicense: this.normalizeLicense(oldPkg), changeType: 'removed' });
    }

    return {
      summary: {
        totalOld: oldLockfile.packages.length,
        totalNew: newLockfile.packages.length,
        added: added.length,
        removed: removed.length,
        changed: changed.length
      },
      added,
      removed,
      changed,
      unchanged,
      risks: this.identifyRisks(added, removed, changed),
      errors: [...this.errors, ...this.licenseNormalizer.getErrors(), ...oldLockfile.errors, ...newLockfile.errors]
    };
  }

  buildPackageMap(packages) {
    const map = new Map();
    for (const pkg of packages) map.set(pkg.name + '@' + pkg.version, pkg);
    return map;
  }

  comparePackage(oldPkg, newPkg) {
    const oldLicense = this.normalizeLicense(oldPkg);
    const newLicense = this.normalizeLicense(newPkg);
    const versionChanged = oldPkg.version !== newPkg.version;
    const licenseChanged = oldLicense.normalized !== newLicense.normalized;
    return { name: oldPkg.name, oldVersion: oldPkg.version, newVersion: newPkg.version, oldLicense, newLicense, versionChanged, licenseChanged, hasChanged: versionChanged || licenseChanged };
  }

  normalizeLicense(pkg) { return this.licenseNormalizer.normalize(pkg.license, pkg.name, pkg.path); }

  identifyRisks(added, removed, changed) {
    const highRisk = [];
    const mediumRisk = [];
    const unknownRisk = [];
    const licenseChanges = [];

    for (const pkg of added) {
      if (pkg.normalizedLicense.risk === RISK_LEVELS.HIGH) highRisk.push({ package: pkg, reason: 'new high-risk license' });
      else if (pkg.normalizedLicense.risk === RISK_LEVELS.MEDIUM) mediumRisk.push({ package: pkg, reason: 'new medium-risk license' });
      else if (pkg.normalizedLicense.risk === RISK_LEVELS.UNKNOWN) unknownRisk.push({ package: pkg, reason: 'new unknown license' });
    }

    for (const diff of changed) {
      if (diff.oldLicense.risk !== diff.newLicense.risk && this.riskToNumber(diff.newLicense.risk) > this.riskToNumber(diff.oldLicense.risk)) {
        licenseChanges.push({ package: diff, reason: 'license risk increased', oldLicense: diff.oldLicense, newLicense: diff.newLicense });
      }
    }

    return { highRisk, mediumRisk, unknownRisk, licenseChanges, totalAlerts: highRisk.length + mediumRisk.length + unknownRisk.length + licenseChanges.length };
  }

  riskToNumber(risk) { const order = { low: 1, medium: 2, high: 3, unknown: 4 }; return order[risk] || 4; }
}

module.exports = DependencyComparator;
`,

  'src/report-generator.js': `const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { RISK_LEVELS } = require('./license-normalizer');

class ReportGenerator {
  constructor(options = {}) { this.options = { outputDir: '.', reportName: 'license-diff-report', ...options }; }

  generateTerminalSummary(result) {
    const { summary, risks } = result;
    const lines = [];
    lines.push('');
    lines.push(chalk.bold.cyan('NPM License Diff Report'));
    lines.push(chalk.gray('========================================'));
    lines.push('Packages: ' + summary.totalOld + ' -> ' + summary.totalNew);
    lines.push(chalk.green('Added: ' + summary.added) + ' | ' + chalk.red('Removed: ' + summary.removed) + ' | ' + chalk.yellow('Changed: ' + summary.changed));
    lines.push('');
    if (risks.totalAlerts > 0) {
      lines.push(chalk.bold.red('Alerts: ' + risks.totalAlerts));
      lines.push('  High: ' + risks.highRisk.length + ' | Medium: ' + risks.mediumRisk.length + ' | Unknown: ' + risks.unknownRisk.length);
    } else {
      lines.push(chalk.green('No risks detected'));
    }
    lines.push('');
    return lines.join('\\n');
  }

  generateJSON(result) { return JSON.stringify({ generatedAt: new Date().toISOString(), summary: result.summary, risks: result.risks, errors: result.errors }, null, 2); }

  generateMarkdown(result) {
    const lines = ['# NPM License Diff Report', '', 'Generated: ' + new Date().toLocaleString(), '', '## Summary', '', 'Total Old: ' + result.summary.totalOld, 'Total New: ' + result.summary.totalNew, '', '## Alerts: ' + result.risks.totalAlerts];
    if (result.risks.highRisk.length > 0) {
      lines.push('', '### High Risk (' + result.risks.highRisk.length + ')');
      result.risks.highRisk.forEach(r => lines.push('- ' + r.package.name + '@' + r.package.version + ': ' + r.reason));
    }
    return lines.join('\\n');
  }

  writeFiles(result) {
    const jsonPath = path.join(this.options.outputDir, this.options.reportName + '.json');
    const mdPath = path.join(this.options.outputDir, this.options.reportName + '.md');
    fs.writeFileSync(jsonPath, this.generateJSON(result));
    fs.writeFileSync(mdPath, this.generateMarkdown(result));
    return { jsonPath, mdPath };
  }
}

module.exports = ReportGenerator;
`,

  'src/index.js': `const LockfileParser = require('./lockfile-parser');
const LicenseNormalizer = require('./license-normalizer');
const DependencyComparator = require('./dependency-comparator');
const ReportGenerator = require('./report-generator');

class LicenseDiff {
  constructor(options = {}) {
    this.options = Object.assign({ outputDir: '.', reportName: 'license-diff-report' }, options);
  }

  run(oldLockfilePath, newLockfilePath) {
    const oldData = new LockfileParser(oldLockfilePath).parse();
    const newData = new LockfileParser(newLockfilePath).parse();
    const result = new DependencyComparator().compare(oldData, newData);
    const reportGenerator = new ReportGenerator(this.options);
    return { result, terminalOutput: reportGenerator.generateTerminalSummary(result), filePaths: reportGenerator.writeFiles(result) };
  }

  static compare(oldPath, newPath, options) {
    return new LicenseDiff(options).run(oldPath, newPath);
  }
}

module.exports = LicenseDiff;
module.exports.LockfileParser = LockfileParser;
module.exports.LicenseNormalizer = LicenseNormalizer;
module.exports.DependencyComparator = DependencyComparator;
module.exports.ReportGenerator = ReportGenerator;
`,

  'bin/license-diff.js': `#!/usr/bin/env node
const { Command } = require('commander');
const path = require('path');
const LicenseDiff = require('../src/index');
const program = new Command();
program.name('license-diff').description('NPM License Diff CLI Tool').version('1.0.0');
program
  .argument('<old-lockfile>', 'old lock file path')
  .argument('<new-lockfile>', 'new lock file path')
  .option('-o, --output <directory>', 'output directory', '.')
  .option('-q, --quiet', 'quiet mode')
  .action((oldLockfile, newLockfile, options) => {
    try {
      const result = LicenseDiff.compare(path.resolve(oldLockfile), path.resolve(newLockfile), { outputDir: path.resolve(options.output) });
      if (!options.quiet) console.log(result.terminalOutput);
      process.exit(result.result.risks.totalAlerts > 0 ? 1 : 0);
    } catch (e) {
      console.error('Error:', e.message);
      process.exit(2);
    }
  });
program.parse();
`
};

for (const [filePath, content] of Object.entries(files)) {
  fs.writeFileSync(filePath, content);
  console.log('Created:', filePath);
}

console.log('All files created successfully!');
