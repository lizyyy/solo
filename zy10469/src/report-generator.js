const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ReportGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateConsoleSummary(result) {
    const lines = [];
    const separator = '='.repeat(70);
    
    lines.push('');
    lines.push(separator);
    lines.push(chalk.bold('Proto 兼容性检查报告'));
    lines.push(separator);
    lines.push('');

    const status = result.isCompatible 
      ? chalk.green('✓ 兼容') 
      : chalk.red('✗ 不兼容');
    
    lines.push(`状态: ${status}`);
    lines.push('');

    lines.push(chalk.bold('摘要统计:'));
    lines.push(`  错误: ${this.formatCount(result.summary.errors, 'error')}`);
    lines.push(`  警告: ${this.formatCount(result.summary.warnings, 'warning')}`);
    lines.push(`  信息: ${this.formatCount(result.summary.infos, 'info')}`);
    lines.push(`  总计: ${result.summary.total}`);
    lines.push('');

    if (result.issues.length > 0) {
      lines.push(chalk.bold('详细问题列表:'));
      lines.push('');

      const errors = result.issues.filter(i => i.type === 'error');
      const warnings = result.issues.filter(i => i.type === 'warning');
      const infos = result.issues.filter(i => i.type === 'info');

      if (errors.length > 0) {
        lines.push(chalk.red.bold('  错误:'));
        errors.forEach((issue, idx) => {
          lines.push(this.formatIssue(issue, idx + 1, '  '));
        });
        lines.push('');
      }

      if (warnings.length > 0) {
        lines.push(chalk.yellow.bold('  警告:'));
        warnings.forEach((issue, idx) => {
          lines.push(this.formatIssue(issue, idx + 1, '  '));
        });
        lines.push('');
      }

      if (infos.length > 0) {
        lines.push(chalk.blue.bold('  信息:'));
        infos.forEach((issue, idx) => {
          lines.push(this.formatIssue(issue, idx + 1, '  '));
        });
        lines.push('');
      }
    }

    lines.push(separator);
    lines.push('');

    return lines.join('\n');
  }

  formatIssue(issue, num, indent) {
    const typeColors = {
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    };
    const color = typeColors[issue.type];
    const typeLabel = { error: '错误', warning: '警告', info: '信息' }[issue.type];

    const lines = [];
    lines.push(`${indent}${num}. [${color(typeLabel)}] ${issue.message}`);
    lines.push(`${indent}   代码: ${issue.code}`);
    
    if (issue.details.fileName || issue.details.line) {
      const location = [];
      if (issue.details.fileName) location.push(`文件: ${issue.details.fileName}`);
      if (issue.details.line) location.push(`行号: ${issue.details.line}`);
      lines.push(`${indent}   位置: ${location.join(', ')}`);
    }

    return lines.join('\n');
  }

  formatCount(count, type) {
    if (count === 0) return String(count);
    const colors = { error: chalk.red, warning: chalk.yellow, info: chalk.blue };
    return colors[type](String(count));
  }

  generateJsonReport(result, protoData, snapshotInfo) {
    const report = {
      generatedAt: new Date().toISOString(),
      isCompatible: result.isCompatible,
      summary: result.summary,
      issues: result.issues.map(issue => ({
        id: issue.id,
        type: issue.type,
        code: issue.code,
        message: issue.message,
        details: issue.details
      })),
      protoData: {
        messages: protoData.messages.map(m => ({
          name: m.name,
          fullName: m.fullName,
          fileName: m.fileName,
          fieldCount: m.fields.size
        })),
        enums: protoData.enums.map(e => ({
          name: e.name,
          fullName: e.fullName,
          fileName: e.fileName,
          valueCount: e.values.size
        })),
        services: protoData.services.map(s => ({
          name: s.name,
          fullName: s.fullName,
          fileName: s.fileName,
          methodCount: s.methods.size
        }))
      },
      snapshot: snapshotInfo ? {
        version: snapshotInfo.version,
        createdAt: snapshotInfo.createdAt
      } : null
    };

    const reportPath = path.join(this.outputDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    
    return {
      report: report,
      path: reportPath
    };
  }

  generateMarkdownReport(result, protoData, snapshotInfo) {
    const lines = [];
    const timestamp = new Date().toLocaleString('zh-CN');

    lines.push('# Proto 兼容性检查报告');
    lines.push('');
    lines.push(`生成时间: ${timestamp}`);
    lines.push('');

    const status = result.isCompatible ? '✅ 兼容' : '❌ 不兼容';
    lines.push(`## 检查状态: ${status}`);
    lines.push('');

    lines.push('## 摘要统计');
    lines.push('');
    lines.push('| 类型 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| ❌ 错误 | ${result.summary.errors} |`);
    lines.push(`| ⚠️ 警告 | ${result.summary.warnings} |`);
    lines.push(`| ℹ️ 信息 | ${result.summary.infos} |`);
    lines.push(`| **总计** | **${result.summary.total}** |`);
    lines.push('');

    if (snapshotInfo) {
      lines.push('## 快照信息');
      lines.push('');
      lines.push(`- 快照版本: ${snapshotInfo.version}`);
      lines.push(`- 创建时间: ${snapshotInfo.createdAt}`);
      lines.push('');
    }

    const errors = result.issues.filter(i => i.type === 'error');
    const warnings = result.issues.filter(i => i.type === 'warning');
    const infos = result.issues.filter(i => i.type === 'info');

    if (errors.length > 0) {
      lines.push('## ❌ 错误');
      lines.push('');
      errors.forEach((issue, idx) => {
        lines.push(this.formatMarkdownIssue(issue, idx + 1));
      });
    }

    if (warnings.length > 0) {
      lines.push('## ⚠️ 警告');
      lines.push('');
      warnings.forEach((issue, idx) => {
        lines.push(this.formatMarkdownIssue(issue, idx + 1));
      });
    }

    if (infos.length > 0) {
      lines.push('## ℹ️ 信息');
      lines.push('');
      infos.forEach((issue, idx) => {
        lines.push(this.formatMarkdownIssue(issue, idx + 1));
      });
    }

    lines.push('## Proto 文件概览');
    lines.push('');
    
    if (protoData.messages.length > 0) {
      lines.push('### 消息 (Messages)');
      lines.push('');
      lines.push('| 消息名称 | 文件 | 字段数 |');
      lines.push('|----------|------|--------|');
      protoData.messages.forEach(m => {
        lines.push(`| ${m.fullName} | ${m.fileName} | ${m.fields.size} |`);
      });
      lines.push('');
    }

    if (protoData.enums.length > 0) {
      lines.push('### 枚举 (Enums)');
      lines.push('');
      lines.push('| 枚举名称 | 文件 | 值数 |');
      lines.push('|----------|------|------|');
      protoData.enums.forEach(e => {
        lines.push(`| ${e.fullName} | ${e.fileName} | ${e.values.size} |`);
      });
      lines.push('');
    }

    if (protoData.services.length > 0) {
      lines.push('### 服务 (Services)');
      lines.push('');
      lines.push('| 服务名称 | 文件 | 方法数 |');
      lines.push('|----------|------|--------|');
      protoData.services.forEach(s => {
        lines.push(`| ${s.fullName} | ${s.fileName} | ${s.methods.size} |`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('*此报告由 proto-compat 工具自动生成*');

    const content = lines.join('\n');
    const reportPath = path.join(this.outputDir, 'report.md');
    fs.writeFileSync(reportPath, content, 'utf-8');

    return {
      content: content,
      path: reportPath
    };
  }

  formatMarkdownIssue(issue, num) {
    const lines = [];
    lines.push(`### ${num}. ${issue.message}`);
    lines.push('');
    lines.push(`- **代码**: \`${issue.code}\``);
    
    const details = issue.details;
    if (details.fileName || details.line) {
      const loc = [];
      if (details.fileName) loc.push(details.fileName);
      if (details.line) loc.push(`行 ${details.line}`);
      lines.push(`- **位置**: ${loc.join(', ')}`);
    }

    if (details.oldFileName && details.newFileName) {
      lines.push(`- **原始位置**: ${details.oldFileName}:${details.oldLine}`);
      lines.push(`- **新位置**: ${details.newFileName}:${details.newLine}`);
    }

    if (details.fieldName) {
      lines.push(`- **字段**: ${details.messageName}.${details.fieldName}`);
    }

    if (details.fieldNumber) {
      lines.push(`- **字段编号**: ${details.fieldNumber}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  printConsoleSummary(result) {
    console.log(this.generateConsoleSummary(result));
  }
}

module.exports = ReportGenerator;
