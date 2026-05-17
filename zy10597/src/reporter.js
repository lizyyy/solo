const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class Reporter {
  constructor(outputDir = './audit-reports') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateTimestamp() {
    const now = new Date();
    return now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
  }

  generateReport(auditResult, inputInfo = {}) {
    const timestamp = this.generateTimestamp();
    const baseName = `cookie-audit-${timestamp}`;
    
    const reportData = {
      metadata: {
        timestamp: new Date().toISOString(),
        timestamp,
        inputInfo,
        version: '1.0.0'
      },
      ...auditResult
    };

    const jsonPath = path.join(this.outputDir, `${baseName}.json`);
    const mdPath = path.join(this.outputDir, `${baseName}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf-8');
    fs.writeFileSync(mdPath, this.generateMarkdown(reportData), 'utf-8');

    return {
      jsonPath,
      mdPath,
      timestamp,
      summary: reportData.summary
    };
  }

  generateMarkdown(reportData) {
    const { metadata, summary, normal, risks, unparseable, domainAnalysis } = reportData;
    
    let md = `# Cookie 域审计报告\n\n`;
    
    md += `## 审计概览\n\n`;
    md += `- 审计时间: ${metadata.timestamp}\n`;
    md += `- 输入源: ${metadata.inputInfo.source || 'unknown'}\n`;
    md += `- 总计 Cookie: **${summary.total}**\n`;
    md += `- 正常 Cookie: **${summary.valid}**\n`;
    md += `- 异常 Cookie: **${summary.invalid}**\n\n`;

    md += `### 风险分级统计\n\n`;
    md += `| 风险等级 | 数量 |\n`;
    md += `|---------|------|\n`;
    md += `| 🔴 严重 (Critical) | ${summary.risks.critical} |\n`;
    md += `| 🟠 高 (High) | ${summary.risks.high} |\n`;
    md += `| 🟡 中 (Medium) | ${summary.risks.medium} |\n`;
    md += `| 🟢 低 (Low) | ${summary.risks.low} |\n`;
    md += `| 🔵 信息 (Info) | ${summary.risks.info} |\n\n`;

    if (domainAnalysis && domainAnalysis.totalConflicts > 0) {
      md += `## ⚠️ 域冲突分析\n\n`;
      md += `发现 **${domainAnalysis.totalConflicts}** 个潜在冲突\n\n`;
      
      domainAnalysis.conflicts.forEach((conflict, index) => {
        const riskEmoji = conflict.riskLevel === 'critical' ? '🔴' : '🟠';
        md += `### ${riskEmoji} 冲突 #${index + 1}: ${conflict.cookieName}\n\n`;
        md += `- 问题: ${conflict.message}\n`;
        md += `- 涉及域: ${conflict.domains.join(', ')}\n`;
        md += `- 涉及路径: ${conflict.paths.join(', ')}\n`;
        md += `- Cookie 数量: ${conflict.cookieCount}\n\n`;
        md += `| 来源文件 | Domain | Path | SameSite | Secure | HttpOnly |\n`;
        md += `|---------|--------|------|----------|--------|----------|\n`;
        conflict.cookies.forEach(c => {
          md += `| ${c.source || 'unknown'} | ${c.domain} | ${c.path} | ${c.sameSite} | ${c.secure ? '✓' : '✗'} | ${c.httpOnly ? '✓' : '✗'} |\n`;
        });
        md += '\n';
      });
    }

    if (risks.length > 0) {
      md += `## 🚨 风险项详情\n\n`;
      
      const criticalRisks = risks.filter(r => r.risks.some(risk => risk.level === 'critical'));
      const highRisks = risks.filter(r => r.risks.some(risk => risk.level === 'high'));
      const mediumRisks = risks.filter(r => r.risks.some(risk => risk.level === 'medium'));
      const lowRisks = risks.filter(r => r.risks.some(risk => risk.level === 'low'));

      if (criticalRisks.length > 0) {
        md += `### 🔴 严重风险 (${criticalRisks.length})\n\n`;
        md += `| Cookie 名称 | Domain | Path | 风险描述 | 来源 |\n`;
        md += `|----------|--------|------|----------|------|\n`;
        criticalRisks.forEach(item => {
          const riskDesc = item.risks.filter(r => r.level === 'critical').map(r => r.message).join('; ');
          md += `| ${item.cookie.name} | ${item.cookie.domain} | ${item.cookie.path} | ${riskDesc} | ${item.cookie.source || 'unknown'} |\n`;
        });
        md += '\n';
      }

      if (highRisks.length > 0) {
        md += `### 🟠 高风险 (${highRisks.length})\n\n`;
        md += `| Cookie 名称 | Domain | Path | 风险描述 | 来源 |\n`;
        md += `|----------|--------|------|----------|------|\n`;
        highRisks.forEach(item => {
          const riskDesc = item.risks.filter(r => r.level === 'high').map(r => r.message).join('; ');
          md += `| ${item.cookie.name} | ${item.cookie.domain} | ${item.cookie.path} | ${riskDesc} | ${item.cookie.source || 'unknown'} |\n`;
        });
        md += '\n';
      }

      if (mediumRisks.length > 0) {
        md += `### 🟡 中风险 (${mediumRisks.length})\n\n`;
        md += `| Cookie 名称 | Domain | Path | 风险描述 | 来源 |\n`;
        md += `|----------|--------|------|----------|------|\n`;
        mediumRisks.forEach(item => {
          const riskDesc = item.risks.filter(r => r.level === 'medium').map(r => r.message).join('; ');
          md += `| ${item.cookie.name} | ${item.cookie.domain} | ${item.cookie.path} | ${riskDesc} | ${item.cookie.source || 'unknown'} |\n`;
        });
        md += '\n';
      }
    }

    if (normal.length > 0) {
      md += `## ✅ 正常项 (${normal.length})\n\n`;
      md += `| Cookie 名称 | Domain | Path | SameSite | Secure | HttpOnly | 过期时间 | 来源 |\n`;
      md += `|----------|--------|------|----------|--------|----------|----------|------|\n`;
      normal.forEach(item => {
        const c = item.cookie;
        const expires = c.expires ? new Date(c.expires).toLocaleDateString() : '会话';
        md += `| ${c.name} | ${c.domain} | ${c.path} | ${c.sameSite} | ${c.secure ? '✓' : '✗'} | ${c.httpOnly ? '✓' : '✗'} | ${expires} | ${c.source || 'unknown'} |\n`;
      });
      md += '\n';
    }

    if (unparseable.length > 0) {
      md += `## ❌ 无法解析的样本 (${unparseable.length})\n\n`;
      md += `| 来源 | 行号/索引 | 错误信息 |\n`;
      md += `|------|-----------|----------|\n`;
      unparseable.forEach(item => {
        const pos = item.cookie.line !== undefined ? `行 ${item.cookie.line}` : `索引 ${item.cookie.index || 'N/A'}`;
        md += `| ${item.cookie.source || 'unknown'} | ${pos} | ${item.error} |\n`;
      });
      md += '\n';
    }

    md += `## 📝 附录\n\n`;
    md += `### 风险等级说明\n\n`;
    md += `- **Critical (🔴): 立即需要修复的严重安全问题\n`;
    md += `- **High (🟠): 高优先级修复，可能导致安全问题\n`;
    md += `- **Medium (🟡): 中优先级，建议修复\n`;
    md += `- **Low (🟢): 低优先级，最佳实践建议\n`;
    md += `- **Info (🔵): 信息性提示，无需修复\n`;

    return md;
  }

  printConsoleSummary(auditResult, paths) {
    console.log('\n' + chalk.bold.blue('═══════════════════════════════════════════'));
    console.log(chalk.bold.blue('           Cookie 域审计报告'));
    console.log(chalk.bold.blue('═══════════════════════════════════════════\n'));

    const { summary, domainAnalysis } = auditResult;

    console.log(chalk.bold('📊 统计摘要:\n'));
    console.log(`  总计 Cookie: ${chalk.white.bold(summary.total)}`);
    console.log(`  正常 Cookie: ${chalk.green.bold(summary.valid)}`);
    console.log(`  异常 Cookie: ${chalk.red.bold(summary.invalid)}`);
    
    console.log('\n' + chalk.bold('⚠️  风险统计:\n'));
    if (summary.risks.critical > 0) console.log(`  🔴 严重: ${chalk.red.bold(summary.risks.critical)}`);
    if (summary.risks.high > 0) console.log(`  🟠 高: ${chalk.yellow.bold(summary.risks.high)}`);
    if (summary.risks.medium > 0) console.log(`  🟡 中: ${chalk.blue.bold(summary.risks.medium)}`);
    if (summary.risks.low > 0) console.log(`  🟢 低: ${chalk.green.bold(summary.risks.low)}`);
    if (summary.risks.info > 0) console.log(`  🔵 信息: ${chalk.cyan.bold(summary.risks.info)}`);

    if (domainAnalysis && domainAnalysis.totalConflicts > 0) {
      console.log('\n' + chalk.bold.red('🚨 域冲突警告:'));
      console.log(chalk.red(`  发现 ${domainAnalysis.totalConflicts} 个潜在登录串号风险!`));
    }

    console.log('\n' + chalk.bold('📄 报告文件:\n'));
    console.log(`  JSON: ${chalk.cyan(paths.jsonPath)}`);
    console.log(`  Markdown: ${chalk.cyan(paths.mdPath)}`);
    
    console.log('\n' + chalk.bold.blue('═══════════════════════════════════════════') + '\n');

    if (summary.risks.critical > 0 || summary.risks.high > 0) {
      process.exitCode = 1;
    }
  }
}

module.exports = Reporter;
