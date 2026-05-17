const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ReportGenerator {
  constructor(options = {}) {
    this.options = {
      colorize: options.colorize !== false,
      showAllPackages: options.showAllPackages || false,
      ...options
    };
  }

  generateTerminalSummary(comparisonResults, badRows = null) {
    const lines = [];
    const { added, removed, upgraded, downgraded, licenseChanged, unchanged, hasChanges } = comparisonResults;

    lines.push('');
    lines.push(this.formatHeader('📋  Dependency License Change Summary'));
    lines.push('');

    if (!hasChanges) {
      lines.push(chalk.green('  ✅ No changes detected in dependencies or licenses'));
    } else {
      const summaryLine = [];
      if (added.length > 0) summaryLine.push(chalk.green(`+${added.length} added`));
      if (removed.length > 0) summaryLine.push(chalk.red(`-${removed.length} removed`));
      if (upgraded.length > 0) summaryLine.push(chalk.blue(`↑${upgraded.length} upgraded`));
      if (downgraded.length > 0) summaryLine.push(chalk.yellow(`↓${downgraded.length} downgraded`));
      if (licenseChanged.length > 0) summaryLine.push(chalk.magenta(`⚡${licenseChanged.length} license changed`));
      lines.push(`  ${summaryLine.join('  ')}`);
    }

    lines.push('');

    if (licenseChanged.length > 0) {
      lines.push(this.formatSection('⚠️  License Changes'));
      for (const pkg of licenseChanged) {
        const riskColor = this.getRiskColor(pkg.risk?.highestLevel);
        lines.push(`  ${chalk.bold(pkg.name)}:`);
        lines.push(`    ${chalk.gray(pkg.oldVersion)} [${chalk.yellow(pkg.oldLicense)}] → ${chalk.green(pkg.newVersion)} [${riskColor(pkg.newLicense)}]`);
        if (pkg.risk?.highestLevel !== 'low') {
          for (const risk of pkg.risk.risks) {
            lines.push(`      ${this.getRiskIcon(risk.level)} ${this.getRiskColor(risk.level)(risk.message)}`);
          }
        }
      }
      lines.push('');
    }

    if (added.length > 0) {
      lines.push(this.formatSection('➕ Added Dependencies'));
      for (const pkg of added) {
        const riskColor = this.getRiskColor(pkg.risk?.highestLevel);
        lines.push(`  ${chalk.bold(pkg.name)}@${chalk.green(pkg.version)} - ${riskColor(pkg.normalizedLicense)}`);
        if (pkg.risk?.highestLevel !== 'low') {
          for (const risk of pkg.risk.risks) {
            lines.push(`      ${this.getRiskIcon(risk.level)} ${this.getRiskColor(risk.level)(risk.message)}`);
          }
        }
      }
      lines.push('');
    }

    if (removed.length > 0) {
      lines.push(this.formatSection('➖ Removed Dependencies'));
      for (const pkg of removed) {
        lines.push(`  ${chalk.strikethrough(chalk.bold(pkg.name))}@${chalk.strikethrough(pkg.version)} - ${pkg.license}`);
      }
      lines.push('');
    }

    if (upgraded.length > 0) {
      lines.push(this.formatSection('⬆️  Upgraded Dependencies'));
      for (const pkg of upgraded.slice(0, 10)) {
        lines.push(`  ${chalk.bold(pkg.name)}: ${chalk.gray(pkg.oldVersion)} → ${chalk.green(pkg.newVersion)}`);
      }
      if (upgraded.length > 10) {
        lines.push(`  ... and ${upgraded.length - 10} more upgraded packages`);
      }
      lines.push('');
    }

    if (downgraded.length > 0) {
      lines.push(this.formatSection('⬇️  Downgraded Dependencies'));
      for (const pkg of downgraded.slice(0, 10)) {
        lines.push(`  ${chalk.bold(pkg.name)}: ${chalk.gray(pkg.oldVersion)} → ${chalk.yellow(pkg.newVersion)}`);
      }
      if (downgraded.length > 10) {
        lines.push(`  ... and ${downgraded.length - 10} more downgraded packages`);
      }
      lines.push('');
    }

    if (this.options.showAllPackages && unchanged.length > 0) {
      lines.push(this.formatSection(`🔒 Unchanged Dependencies (${unchanged.length} total)`));
      lines.push(`  Run with --show-all to see all unchanged packages`);
      lines.push('');
    }

    if (badRows && badRows.getCount() > 0) {
      lines.push(this.formatSection(`❌ Parse Errors (${badRows.getCount()})`));
      for (const bad of badRows.getAll().slice(0, 5)) {
        let lineInfo = bad.lineNumber ? `line ${bad.lineNumber}: ` : '';
        lines.push(`  ${chalk.red(lineInfo + bad.reason)}`);
        if (bad.row) {
          const rowStr = typeof bad.row === 'string' ? bad.row : JSON.stringify(bad.row);
          lines.push(`    ${chalk.gray(rowStr.substring(0, 100))}`);
        }
      }
      if (badRows.getCount() > 5) {
        lines.push(`  ... and ${badRows.getCount() - 5} more parse errors`);
      }
      lines.push('');
    }

    const criticalCount = this.countRiskLevel(comparisonResults, 'critical');
    const highCount = this.countRiskLevel(comparisonResults, 'high');
    const mediumCount = this.countRiskLevel(comparisonResults, 'medium');

    if (criticalCount > 0 || highCount > 0 || mediumCount > 0) {
      lines.push(this.formatSection('🚨 Risk Summary'));
      if (criticalCount > 0) lines.push(`  ${chalk.red(`CRITICAL: ${criticalCount} packages`)}`);
      if (highCount > 0) lines.push(`  ${chalk.magenta(`HIGH: ${highCount} packages`)}`);
      if (mediumCount > 0) lines.push(`  ${chalk.yellow(`MEDIUM: ${mediumCount} packages`)}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  generateJSONReport(comparisonResults, snapshot, badRows = null, metadata = {}) {
    return JSON.stringify({
      version: '1.0.0',
      generated: new Date().toISOString(),
      metadata,
      summary: {
        hasChanges: comparisonResults.hasChanges,
        counts: {
          added: comparisonResults.added.length,
          removed: comparisonResults.removed.length,
          upgraded: comparisonResults.upgraded.length,
          downgraded: comparisonResults.downgraded.length,
          licenseChanged: comparisonResults.licenseChanged.length,
          unchanged: comparisonResults.unchanged.length
        }
      },
      changes: {
        added: comparisonResults.added,
        removed: comparisonResults.removed,
        upgraded: comparisonResults.upgraded,
        downgraded: comparisonResults.downgraded,
        licenseChanged: comparisonResults.licenseChanged
      },
      unchanged: comparisonResults.unchanged,
      badRows: badRows ? badRows.getAll() : [],
      snapshot
    }, null, 2);
  }

  generateMarkdownReport(comparisonResults, snapshot, badRows = null, metadata = {}) {
    const lines = [];

    lines.push('# Dependency License Change Report');
    lines.push('');
    lines.push(`*Generated: ${new Date().toISOString()}*`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push('| Change Type | Count |');
    lines.push('|-------------|-------|');
    lines.push(`| Added | ${comparisonResults.added.length} |`);
    lines.push(`| Removed | ${comparisonResults.removed.length} |`);
    lines.push(`| Upgraded | ${comparisonResults.upgraded.length} |`);
    lines.push(`| Downgraded | ${comparisonResults.downgraded.length} |`);
    lines.push(`| License Changed | ${comparisonResults.licenseChanged.length} |`);
    lines.push(`| Unchanged | ${comparisonResults.unchanged.length} |`);
    lines.push('');

    if (comparisonResults.licenseChanged.length > 0) {
      lines.push('## ⚠️ License Changes');
      lines.push('');
      lines.push('| Package | Old Version → New Version | Old License → New License | Risk |');
      lines.push('|---------|---------------------------|---------------------------|------|');
      for (const pkg of comparisonResults.licenseChanged) {
        const riskBadge = this.getRiskBadge(pkg.risk?.highestLevel);
        lines.push(`| \`${pkg.name}\` | \`${pkg.oldVersion}\` → \`${pkg.newVersion}\` | \`${pkg.oldLicense}\` → \`${pkg.newLicense}\` | ${riskBadge} |`);
      }
      lines.push('');
    }

    if (comparisonResults.added.length > 0) {
      lines.push('## ➕ Added Dependencies');
      lines.push('');
      lines.push('| Package | Version | License | Risk |');
      lines.push('|---------|---------|---------|------|');
      for (const pkg of comparisonResults.added) {
        const riskBadge = this.getRiskBadge(pkg.risk?.highestLevel);
        lines.push(`| \`${pkg.name}\` | \`${pkg.version}\` | \`${pkg.normalizedLicense}\` | ${riskBadge} |`);
      }
      lines.push('');
    }

    if (comparisonResults.removed.length > 0) {
      lines.push('## ➖ Removed Dependencies');
      lines.push('');
      lines.push('| Package | Version | License |');
      lines.push('|---------|---------|---------|');
      for (const pkg of comparisonResults.removed) {
        lines.push(`| ~~${pkg.name}~~ | ~~${pkg.version}~~ | ~~${pkg.license}~~ |`);
      }
      lines.push('');
    }

    if (comparisonResults.upgraded.length > 0) {
      lines.push('## ⬆️ Upgraded Dependencies');
      lines.push('');
      lines.push('| Package | Old Version | New Version | License |');
      lines.push('|---------|-------------|-------------|---------|');
      for (const pkg of comparisonResults.upgraded) {
        lines.push(`| \`${pkg.name}\` | \`${pkg.oldVersion}\` | \`${pkg.newVersion}\` | \`${pkg.license}\` |`);
      }
      lines.push('');
    }

    if (comparisonResults.downgraded.length > 0) {
      lines.push('## ⬇️ Downgraded Dependencies');
      lines.push('');
      lines.push('| Package | Old Version | New Version | License |');
      lines.push('|---------|-------------|-------------|---------|');
      for (const pkg of comparisonResults.downgraded) {
        lines.push(`| \`${pkg.name}\` | \`${pkg.oldVersion}\` | \`${pkg.newVersion}\` | \`${pkg.license}\` |`);
      }
      lines.push('');
    }

    if (badRows && badRows.getCount() > 0) {
      lines.push('## ❌ Parse Errors');
      lines.push('');
      lines.push('| Source | Line | Reason |');
      lines.push('|--------|------|--------|');
      for (const bad of badRows.getAll()) {
        lines.push(`| ${bad.source || 'N/A'} | ${bad.lineNumber || 'N/A'} | ${this.escapeMarkdown(bad.reason)} |`);
      }
      lines.push('');
    }

    if (snapshot && snapshot.summary) {
      lines.push('## 📊 License Distribution');
      lines.push('');
      lines.push('| License | Count |');
      lines.push('|---------|-------|');
      for (const [license, count] of Object.entries(snapshot.summary.licenseDistribution || {})) {
        lines.push(`| \`${license}\` | ${count} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*This report was generated by the License Snapshot CLI tool*');

    return lines.join('\n');
  }

  saveReport(content, filePath) {
    const outputDir = path.dirname(filePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  formatHeader(text) {
    return chalk.bold.underline(text);
  }

  formatSection(text) {
    return chalk.bold(text);
  }

  getRiskColor(level) {
    switch (level) {
      case 'critical': return chalk.red.bold;
      case 'high': return chalk.magenta.bold;
      case 'medium': return chalk.yellow.bold;
      case 'low': return chalk.green.bold;
      default: return chalk.gray;
    }
  }

  getRiskIcon(level) {
    switch (level) {
      case 'critical': return '🛑';
      case 'high': return '🟣';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  getRiskBadge(level) {
    switch (level) {
      case 'critical': return '🔴 **CRITICAL**';
      case 'high': return '🟣 **HIGH**';
      case 'medium': return '🟡 **MEDIUM**';
      case 'low': return '🟢 LOW';
      default: return '⚪ UNKNOWN';
    }
  }

  countRiskLevel(results, level) {
    let count = 0;
    for (const pkg of results.added) {
      if (pkg.risk?.highestLevel === level) count++;
    }
    for (const pkg of results.licenseChanged) {
      if (pkg.risk?.highestLevel === level) count++;
    }
    return count;
  }

  escapeMarkdown(text) {
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }
}

module.exports = { ReportGenerator };