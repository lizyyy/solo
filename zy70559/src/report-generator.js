const fs = require('fs');
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
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    console.log(chalk.white(`  Total: ${summary.total} packages`));
    console.log(chalk.green(`  ✅ Added: ${summary.added}`));
    console.log(chalk.red(`  ❌ Removed: ${summary.removed}`));
    console.log(chalk.yellow(`  🔄 Changed: ${summary.changed}`));
    console.log(chalk.gray(`  ➖ Unchanged: ${summary.unchanged}\n`));
  }

  printRiskPackages(comparison) {
    const riskPackages = this.extractRiskPackages(comparison);

    if (riskPackages.length === 0) {
      console.log(chalk.green('✅ No license risk changes found\n'));
      return;
    }

    console.log(chalk.red('⚠️  RISK PACKAGE CHANGES:\n'));

    riskPackages.forEach(pkg => {
      const color = this.riskColors[pkg.risk];
      const label = this.riskLabels[pkg.risk];

      if (pkg.changeType === 'added') {
        console.log(color(`  ➕ ${label} - Added: ${pkg.name}@${pkg.version}`));
        console.log(color(`     License: ${pkg.license}`));
        console.log(chalk.gray(`     Path: ${pkg.path}\n`));
      } else if (pkg.changeType === 'riskIncreased') {
        console.log(color(`  ⬆️  ${label} - Risk Increased: ${pkg.name}`));
        console.log(color(`     ${pkg.oldLicense} → ${pkg.newLicense}`));
        console.log(chalk.gray(`     Version: ${pkg.oldVersion} → ${pkg.newVersion}\n`));
      }
    });
  }

  printLicenseChanges(comparison) {
    const licenseChanges = comparison.changed.filter(c => c.licenseChange);

    if (licenseChanges.length === 0) {
      return;
    }

    console.log(chalk.yellow('📝 LICENSE CHANGES:\n'));

    licenseChanges.slice(0, 5).forEach(change => {
      console.log(chalk.white(`  ${change.name}`));
      console.log(chalk.gray(`    ${change.licenseChange.old} → ${change.licenseChange.new}\n`));
    });

    if (licenseChanges.length > 5) {
      console.log(chalk.gray(`  ... and ${licenseChanges.length - 5} more license changes, see full report\n`));
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

    let md = '# NPM License Diff Report\n\n';
    md += `> Generated: ${new Date().toLocaleString()}\n\n`;

    md += '## 📊 Summary\n\n';
    md += '| Category | Count |\n';
    md += '|----------|-------|\n';
    md += `| Total | ${comparison.summary.total} |\n`;
    md += `| Added | ${comparison.summary.added} |\n`;
    md += `| Removed | ${comparison.summary.removed} |\n`;
    md += `| Changed | ${comparison.summary.changed} |\n`;
    md += `| Unchanged | ${comparison.summary.unchanged} |\n\n`;

    if (riskPackages.length > 0) {
      md += '## ⚠️  Risk Warnings\n\n';
      md += '| Risk Level | Change Type | Package | Version | License | Path |\n';
      md += '|------------|-------------|---------|---------|---------|------|\n';

      riskPackages.forEach(pkg => {
        const changeLabel = pkg.changeType === 'added' ? 'Added' : 'Risk Increased';
        md += `| ${this.riskLabels[pkg.risk]} | ${changeLabel} | ${pkg.name} | ${pkg.version || '-'} | ${pkg.license || '-'} | \`${pkg.path || '-'}\` |\n`;
      });
      md += '\n';
    }

    md += '## 📝 Detailed Changes\n\n';

    if (comparison.added.length > 0) {
      md += `### ✅ Added Dependencies (${comparison.added.length})\n\n`;
      md += '| Package | Version | License | Risk Level |\n';
      md += '|---------|---------|---------|------------|\n';
      comparison.added.forEach(pkg => {
        const risk = pkg.normalizedLicense?.risk || RISK_LEVELS.UNKNOWN;
        md += `| ${pkg.name} | ${pkg.version} | ${pkg.license || '-'} | ${this.riskLabels[risk]} |\n`;
      });
      md += '\n';
    }

    if (comparison.removed.length > 0) {
      md += `### ❌ Removed Dependencies (${comparison.removed.length})\n\n`;
      md += '| Package | Version | License |\n';
      md += '|---------|---------|---------|\n';
      comparison.removed.forEach(pkg => {
        md += `| ${pkg.name} | ${pkg.version} | ${pkg.license || '-'} |\n`;
      });
      md += '\n';
    }

    const licenseChanges = comparison.changed.filter(c => c.licenseChange);
    if (licenseChanges.length > 0) {
      md += `### 🔄 License Changes (${licenseChanges.length})\n\n`;
      md += '| Package | Old License | New License | Old Version → New Version |\n';
      md += '|---------|-------------|-------------|---------------------------|\n';
      licenseChanges.forEach(pkg => {
        md += `| ${pkg.name} | ${pkg.licenseChange.old || '-'} | ${pkg.licenseChange.new || '-'} | ${pkg.old.version} → ${pkg.new.version} |\n`;
      });
      md += '\n';
    }

    md += '---\n\n';
    md += '> **Note**: This report was auto-generated by license-diff tool for legal review.\n';
    md += '> Risk levels are for reference only, please evaluate in context.\n';

    if (outputPath) {
      fs.writeFileSync(outputPath, md, 'utf8');
    } else {
      console.log(md);
    }

    return md;
  }
}

module.exports = ReportGenerator;