const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
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
      [RISK_LEVELS.HIGH]: '🔴 高风险',
      [RISK_LEVELS.MEDIUM]: '🟡 中风险',
      [RISK_LEVELS.LOW]: '🟢 低风险',
      [RISK_LEVELS.UNKNOWN]: '⚪ 未知'
    };
  }

  generateConsoleReport(comparison) {
    if (!comparison) {
      console.log(chalk.red('❌ 无法生成报告: 对比数据为空'));
      return;
    }

    this.printSummary(comparison);
    this.printRiskPackages(comparison);
    this.printLicenseChanges(comparison);
  }

  printSummary(comparison) {
    const { summary } = comparison;
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan('📊 许可证差异摘要'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    console.log(chalk.white(`  总计: ${summary.total} 个包`));
    console.log(chalk.green(`  ✅ 新增: ${summary.added}`));
    console.log(chalk.red(`  ❌ 移除: ${summary.removed}`));
    console.log(chalk.yellow(`  🔄 变更: ${summary.changed}`));
    console.log(chalk.gray(`  ➖ 未变: ${summary.unchanged}\n`));
  }

  printRiskPackages(comparison) {
    const riskPackages = this.extractRiskPackages(comparison);

    if (riskPackages.length === 0) {
      console.log(chalk.green('✅ 未发现许可证风险变化\n'));
      return;
    }

    console.log(chalk.red('⚠️  风险包变化:\n'));

    riskPackages.forEach(pkg => {
      const color = this.riskColors[pkg.risk];
      const label = this.riskLabels[pkg.risk];

      if (pkg.changeType === 'added') {
        console.log(color(`  ➕ ${label} - 新增: ${pkg.name}@${pkg.version}`));
        console.log(color(`     许可证: ${pkg.license}`));
        console.log(chalk.gray(`     路径: ${pkg.path}\n`));
      } else if (pkg.changeType === 'riskIncreased') {
        console.log(color(`  ⬆️  ${label} - 风险升级: ${pkg.name}`));
        console.log(color(`     ${pkg.oldLicense} → ${pkg.newLicense}`));
        console.log(chalk.gray(`     版本: ${pkg.oldVersion} → ${pkg.newVersion}\n`));
      }
    });
  }

  printLicenseChanges(comparison) {
    const licenseChanges = comparison.changed.filter(c => c.licenseChange);

    if (licenseChanges.length === 0) {
      return;
    }

    console.log(chalk.yellow('📝 许可证变更详情:\n'));

    licenseChanges.slice(0, 5).forEach(change => {
      console.log(chalk.white(`  ${change.name}`));
      console.log(chalk.gray(`    ${change.licenseChange.old} → ${change.licenseChange.new}\n`));
    });

    if (licenseChanges.length > 5) {
      console.log(chalk.gray(`  ... 还有 ${licenseChanges.length - 5} 个许可证变更，详见完整报告\n`));
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
    const report = this.buildMarkdownReport(comparison);

    if (outputPath) {
      fs.writeFileSync(outputPath, report, 'utf8');
    } else {
      console.log(report);
    }

    return report;
  }

  buildMarkdownReport(comparison) {
    const riskPackages = this.extractRiskPackages(comparison);

    let md = `# NPM 许可证差异报告\n\n`;
    md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    md += `## 📊 摘要\n\n`;
    md += `| 类别 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 总计 | ${comparison.summary.total} |\n`;
    md += `| 新增 | ${comparison.summary.added} |\n`;
    md += `| 移除 | ${comparison.summary.removed} |\n`;
    md += `| 变更 | ${comparison.summary.changed} |\n`;
    md += `| 未变 | ${comparison.summary.unchanged} |\n\n`;

    if (riskPackages.length > 0) {
      md += `## ⚠️  风险警告\n\n`;
      md += `| 风险等级 | 变更类型 | 包名 | 版本 | 许可证 | 路径 |\n`;
      md += `|----------|----------|------|------|--------|------|\n`;

      riskPackages.forEach(pkg => {
        const changeLabel = pkg.changeType === 'added' ? '新增' : '风险升级';
        md += `| ${this.riskLabels[pkg.risk]} | ${changeLabel} | ${pkg.name} | ${pkg.version || '-'} | ${pkg.license || '-'} | \`${pkg.path || '-'}\` |\n`;
      });
      md += `\n`;
    }

    md += `## 📝 详细变更\n\n`;

    if (comparison.added.length > 0) {
      md += `### ✅ 新增依赖 (${comparison.added.length})\n\n`;
      md += `| 包名 | 版本 | 许可证 | 风险等级 |\n`;
      md += `|------|------|--------|----------|\n`;
      comparison.added.forEach(pkg => {
        const risk = pkg.normalizedLicense?.risk || RISK_LEVELS.UNKNOWN;
        md += `| ${pkg.name} | ${pkg.version} | ${pkg.license || '-'} | ${this.riskLabels[risk]} |\n`;
      });
      md += `\n`;
    }

    if (comparison.removed.length > 0) {
      md += `### ❌ 移除依赖 (${comparison.removed.length})\n\n`;
      md += `| 包名 | 版本 | 许可证 |\n`;
      md += `|------|------|--------|\n`;
      comparison.removed.forEach(pkg => {
        md += `| ${pkg.name} | ${pkg.version} | ${pkg.license || '-'} |\n`;
      });
      md += `\n`;
    }

    const licenseChanges = comparison.changed.filter(c => c.licenseChange);
    if (licenseChanges.length > 0) {
      md += `### 🔄 许可证变更 (${licenseChanges.length})\n\n`;
      md += `| 包名 | 旧许可证 | 新许可证 | 旧版本 → 新版本 |\n`;
      md += `|------|----------|----------|----------------|\n`;
      licenseChanges.forEach(pkg => {
        md += `| ${pkg.name} | ${pkg.licenseChange.old || '-'} | ${pkg.licenseChange.new || '-'} | ${pkg.old.version} → ${pkg.new.version} |\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
    md += `> **说明**: 本报告由 license-diff 工具自动生成，用于法务审查。\n`;
    md += `> 风险等级仅供参考，请结合具体业务场景评估。\n`;

    return md;
  }
}

module.exports = ReportGenerator;
