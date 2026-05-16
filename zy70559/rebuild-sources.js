const fs = require('fs');

console.log('Rebuilding source files...\n');

// 1. src/lockfile-parser.js
const lockfileParser = `const fs = require('fs');
const path = require('path');

class LockfileParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.errors = [];
  }

  parse() {
    const content = fs.readFileSync(this.filePath, 'utf8');
    if (this.fileName === 'package-lock.json') return this.parsePackageLock(content);
    throw new Error('Unsupported lock file format');
  }

  parsePackageLock(content) {
    try {
      const data = JSON.parse(content);
      const packages = [];
      if (data.packages) {
        for (const [pkgPath, pkgInfo] of Object.entries(data.packages)) {
          if (pkgPath === '') continue;
          const name = pkgInfo.name || pkgPath.split('/').pop();
          const version = pkgInfo.version;
          if (!version) {
            this.addError(name, 'missing version', pkgPath);
            continue;
          }
          packages.push({
            name,
            version,
            license: this.extractLicense(pkgInfo),
            path: pkgPath,
            dev: pkgInfo.dev || false
          });
        }
      }
      return {
        type: 'package-lock',
        packages,
        errors: this.errors
      };
    } catch (e) {
      this.addError('root', 'JSON parse failed', '/');
      return {
        type: 'package-lock',
        packages: [],
        errors: this.errors
      };
    }
  }

  extractLicense(pkgInfo) {
    if (pkgInfo.license) return pkgInfo.license;
    if (pkgInfo.licenses) {
      return Array.isArray(pkgInfo.licenses)
        ? pkgInfo.licenses.map(l => l.type || l).join(' OR ')
        : (pkgInfo.licenses.type || pkgInfo.licenses);
    }
    return null;
  }

  addError(packageName, reason, location) {
    this.errors.push({
      packageName,
      reason,
      location,
      file: this.filePath,
      timestamp: new Date().toISOString()
    });
  }

  getErrors() {
    return this.errors;
  }
}

module.exports = LockfileParser;`;

fs.writeFileSync('./src/lockfile-parser.js', lockfileParser);
console.log('✅ Created src/lockfile-parser.js');

// 2. src/index.js
const indexJs = `const LockfileParser = require('./lockfile-parser');
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

module.exports = LicenseDiff;`;

fs.writeFileSync('./src/index.js', indexJs);
console.log('✅ Created src/index.js');

// 3. src/dependency-comparator.js
const comparator = `const semver = require('semver');
const LicenseNormalizer = require('./license-normalizer');

class DependencyComparator {
  constructor() {
    this.licenseNormalizer = new LicenseNormalizer();
  }

  compare(oldLock, newLock) {
    if (!oldLock || !newLock) {
      return null;
    }

    const oldDeps = this.createDependencyMap(oldLock.packages);
    const newDeps = this.createDependencyMap(newLock.packages);
    const allNames = new Set([...Object.keys(oldDeps), ...Object.keys(newDeps)]);

    const added = [];
    const removed = [];
    const changed = [];
    const unchanged = [];

    for (const name of allNames) {
      const oldDep = oldDeps[name];
      const newDep = newDeps[name];

      if (!oldDep && newDep) {
        added.push(this.createDependencyInfo(name, newDep, 'added'));
      } else if (oldDep && !newDep) {
        removed.push(this.createDependencyInfo(name, oldDep, 'removed'));
      } else if (oldDep && newDep) {
        const changeInfo = this.compareDependency(name, oldDep, newDep);
        if (changeInfo.hasChanges) {
          changed.push(changeInfo);
        } else {
          unchanged.push(this.createDependencyInfo(name, newDep, 'unchanged'));
        }
      }
    }

    return {
      added,
      removed,
      changed,
      unchanged,
      summary: {
        total: allNames.size,
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        unchanged: unchanged.length
      }
    };
  }

  createDependencyMap(packages) {
    const map = {};
    for (const pkg of packages) {
      map[pkg.name] = pkg;
    }
    return map;
  }

  compareDependency(name, oldDep, newDep) {
    const changes = [];
    const oldVersion = this.getVersion(oldDep);
    const newVersion = this.getVersion(newDep);
    const oldLicense = this.getLicense(oldDep);
    const newLicense = this.getLicense(newDep);

    let versionChange = null;
    if (oldVersion !== newVersion) {
      versionChange = {
        type: 'version',
        old: oldVersion,
        new: newVersion,
        changeType: this.getVersionChangeType(oldVersion, newVersion)
      };
      changes.push(versionChange);
    }

    let licenseChange = null;
    if (oldLicense !== newLicense) {
      const oldNormalized = this.licenseNormalizer.normalize(oldLicense, name);
      const newNormalized = this.licenseNormalizer.normalize(newLicense, name);
      licenseChange = {
        type: 'license',
        old: oldLicense,
        new: newLicense,
        oldNormalized,
        newNormalized
      };
      changes.push(licenseChange);
    }

    return {
      name,
      hasChanges: changes.length > 0,
      changes,
      versionChange,
      licenseChange,
      old: this.createDependencyInfo(name, oldDep, 'old'),
      new: this.createDependencyInfo(name, newDep, 'new')
    };
  }

  getVersion(dep) {
    return dep.version || null;
  }

  getLicense(dep) {
    return dep.license || null;
  }

  getVersionChangeType(oldVersion, newVersion) {
    if (!oldVersion || !newVersion) return 'unknown';

    try {
      if (semver.eq(oldVersion, newVersion)) return 'none';
      if (semver.gt(newVersion, oldVersion)) {
        const oldMajor = semver.major(oldVersion);
        const newMajor = semver.major(newVersion);
        const oldMinor = semver.minor(oldVersion);
        const newMinor = semver.minor(newVersion);

        if (newMajor > oldMajor) return 'major';
        if (newMinor > oldMinor) return 'minor';
        return 'patch';
      }
      if (semver.lt(newVersion, oldVersion)) return 'downgrade';
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  createDependencyInfo(name, dep, status) {
    const version = this.getVersion(dep);
    const license = this.getLicense(dep);
    const normalizedLicense = this.licenseNormalizer.normalize(license, name);

    return {
      name,
      version,
      license,
      normalizedLicense,
      status,
      path: dep.path
    };
  }

  getLicenseErrors() {
    return this.licenseNormalizer.getErrors();
  }
}

module.exports = DependencyComparator;`;

fs.writeFileSync('./src/dependency-comparator.js', comparator);
console.log('✅ Created src/dependency-comparator.js');

// 4. src/report-generator.js
const reportGenerator = `const fs = require('fs');
const chalk = require('chalk');
const { RISK_LEVELS } = require('./license-normalizer');

class ReportGenerator {
  constructor() {
    this.riskColors = {
      [RISK_LEVELS.HIGH]: chalk.red,
      [RISK_LEVELS.MEDIUM]: chalk.yellow,
      [RISK_LEVELS.LOW]: chalk.green,
      [RISK_LEVELS.UNKNOWN]: chalk.gray
    };

    this.riskLabels = {
      [RISK_LEVELS.HIGH]: '🔴 HIGH',
      [RISK_LEVELS.MEDIUM]: '🟡 MEDIUM',
      [RISK_LEVELS.LOW]: '🟢 LOW',
      [RISK_LEVELS.UNKNOWN]: '⚪ UNKNOWN'
    };
  }

  generateConsoleReport(comparison) {
    if (!comparison) {
      console.log(chalk.red('❌ Cannot generate report: comparison data is empty'));
      return;
    }

    this.printSummary(comparison);
    this.printRiskPackages(comparison);
    this.printLicenseChanges(comparison);
  }

  printSummary(comparison) {
    const { summary } = comparison;
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan('📊 LICENSE DIFF SUMMARY'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n'));

    console.log(chalk.white(\`  Total: \${summary.total} packages\`));
    console.log(chalk.green(\`  ✅ Added: \${summary.added}\`));
    console.log(chalk.red(\`  ❌ Removed: \${summary.removed}\`));
    console.log(chalk.yellow(\`  🔄 Changed: \${summary.changed}\`));
    console.log(chalk.gray(\`  ➖ Unchanged: \${summary.unchanged}\\n\`));
  }

  printRiskPackages(comparison) {
    const riskPackages = this.extractRiskPackages(comparison);

    if (riskPackages.length === 0) {
      console.log(chalk.green('✅ No license risk changes found\\n'));
      return;
    }

    console.log(chalk.red('⚠️  RISK PACKAGE CHANGES:\\n'));

    riskPackages.forEach(pkg => {
      const color = this.riskColors[pkg.risk];
      const label = this.riskLabels[pkg.risk];

      if (pkg.changeType === 'added') {
        console.log(color(\`  ➕ \${label} - Added: \${pkg.name}@\${pkg.version}\`));
        console.log(color(\`     License: \${pkg.license}\`));
        console.log(chalk.gray(\`     Path: \${pkg.path}\\n\`));
      } else if (pkg.changeType === 'riskIncreased') {
        console.log(color(\`  ⬆️  \${label} - Risk Increased: \${pkg.name}\`));
        console.log(color(\`     \${pkg.oldLicense} → \${pkg.newLicense}\`));
        console.log(chalk.gray(\`     Version: \${pkg.oldVersion} → \${pkg.newVersion}\\n\`));
      }
    });
  }

  printLicenseChanges(comparison) {
    const licenseChanges = comparison.changed.filter(c => c.licenseChange);

    if (licenseChanges.length === 0) {
      return;
    }

    console.log(chalk.yellow('📝 LICENSE CHANGES:\\n'));

    licenseChanges.slice(0, 5).forEach(change => {
      console.log(chalk.white(\`  \${change.name}\`));
      console.log(chalk.gray(\`    \${change.licenseChange.old} → \${change.licenseChange.new}\\n\`));
    });

    if (licenseChanges.length > 5) {
      console.log(chalk.gray(\`  ... and \${licenseChanges.length - 5} more license changes, see full report\\n\`));
    }
  }

  extractRiskPackages(comparison) {
    const risks = [];

    comparison.added.forEach(pkg => {
      if (pkg.normalizedLicense && 
          (pkg.normalizedLicense.risk === RISK_LEVELS.HIGH || 
           pkg.normalizedLicense.risk === RISK_LEVELS.MEDIUM)) {
        risks.push({
          ...pkg,
          risk: pkg.normalizedLicense.risk,
          changeType: 'added'
        });
      }
    });

    comparison.changed.forEach(pkg => {
      if (pkg.licenseChange) {
        const oldRisk = pkg.licenseChange.oldNormalized?.risk;
        const newRisk = pkg.licenseChange.newNormalized?.risk;
        if (this.isRiskIncreased(oldRisk, newRisk)) {
          risks.push({
            name: pkg.name,
            risk: newRisk,
            changeType: 'riskIncreased',
            oldLicense: pkg.licenseChange.old,
            newLicense: pkg.licenseChange.new,
            oldVersion: pkg.old.version,
            newVersion: pkg.new.version
          });
        }
      }
    });

    return risks.sort((a, b) => this.riskToNumber(b.risk) - this.riskToNumber(a.risk));
  }

  isRiskIncreased(oldRisk, newRisk) {
    const oldNum = this.riskToNumber(oldRisk);
    const newNum = this.riskToNumber(newRisk);
    return newNum > oldNum;
  }

  riskToNumber(risk) {
    const order = { unknown: 0, low: 1, medium: 2, high: 3 };
    return order[risk] || 0;
  }

  generateJsonReport(comparison, outputPath) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: comparison.summary,
      riskAnalysis: this.extractRiskPackages(comparison),
      details: {
        added: comparison.added,
        removed: comparison.removed,
        changed: comparison.changed,
        unchanged: comparison.unchanged.map(p => ({
          name: p.name,
          version: p.version,
          license: p.license
        }))
      }
    };

    const json = JSON.stringify(report, null, 2);

    if (outputPath) {
      fs.writeFileSync(outputPath, json, 'utf8');
    } else {
      console.log(json);
    }

    return report;
  }

  generateMarkdownReport(comparison, outputPath) {
    const riskPackages = this.extractRiskPackages(comparison);

    let md = '# NPM License Diff Report\\n\\n';
    md += \`> Generated: \${new Date().toLocaleString()}\\n\\n\`;

    md += '## 📊 Summary\\n\\n';
    md += '| Category | Count |\\n';
    md += '|----------|-------|\\n';
    md += \`| Total | \${comparison.summary.total} |\\n\`;
    md += \`| Added | \${comparison.summary.added} |\\n\`;
    md += \`| Removed | \${comparison.summary.removed} |\\n\`;
    md += \`| Changed | \${comparison.summary.changed} |\\n\`;
    md += \`| Unchanged | \${comparison.summary.unchanged} |\\n\\n\`;

    if (riskPackages.length > 0) {
      md += '## ⚠️  Risk Warnings\\n\\n';
      md += '| Risk Level | Change Type | Package | Version | License | Path |\\n';
      md += '|------------|-------------|---------|---------|---------|------|\\n';

      riskPackages.forEach(pkg => {
        const changeLabel = pkg.changeType === 'added' ? 'Added' : 'Risk Increased';
        md += \`| \${this.riskLabels[pkg.risk]} | \${changeLabel} | \${pkg.name} | \${pkg.version || '-'} | \${pkg.license || '-'} | \\\`\${pkg.path || '-'}\\\` |\\n\`;
      });
      md += '\\n';
    }

    md += '## 📝 Detailed Changes\\n\\n';

    if (comparison.added.length > 0) {
      md += \`### ✅ Added Dependencies (\${comparison.added.length})\\n\\n\`;
      md += '| Package | Version | License | Risk Level |\\n';
      md += '|---------|---------|---------|------------|\\n';
      comparison.added.forEach(pkg => {
        const risk = pkg.normalizedLicense?.risk || RISK_LEVELS.UNKNOWN;
        md += \`| \${pkg.name} | \${pkg.version} | \${pkg.license || '-'} | \${this.riskLabels[risk]} |\\n\`;
      });
      md += '\\n';
    }

    if (comparison.removed.length > 0) {
      md += \`### ❌ Removed Dependencies (\${comparison.removed.length})\\n\\n\`;
      md += '| Package | Version | License |\\n';
      md += '|---------|---------|---------|\\n';
      comparison.removed.forEach(pkg => {
        md += \`| \${pkg.name} | \${pkg.version} | \${pkg.license || '-'} |\\n\`;
      });
      md += '\\n';
    }

    const licenseChanges = comparison.changed.filter(c => c.licenseChange);
    if (licenseChanges.length > 0) {
      md += \`### 🔄 License Changes (\${licenseChanges.length})\\n\\n\`;
      md += '| Package | Old License | New License | Old Version → New Version |\\n';
      md += '|---------|-------------|-------------|---------------------------|\\n';
      licenseChanges.forEach(pkg => {
        md += \`| \${pkg.name} | \${pkg.licenseChange.old || '-'} | \${pkg.licenseChange.new || '-'} | \${pkg.old.version} → \${pkg.new.version} |\\n\`;
      });
      md += '\\n';
    }

    md += '---\\n\\n';
    md += '> **Note**: This report was auto-generated by license-diff tool for legal review.\\n';
    md += '> Risk levels are for reference only, please evaluate in context.\\n';

    if (outputPath) {
      fs.writeFileSync(outputPath, md, 'utf8');
    } else {
      console.log(md);
    }

    return md;
  }
}

module.exports = ReportGenerator;`;

fs.writeFileSync('./src/report-generator.js', reportGenerator);
console.log('✅ Created src/report-generator.js');

console.log('\n✅ All source files rebuilt successfully!');
