const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('./config');

class Reporter {
  constructor(options) {
    this.options = options;
    this.outputDir = path.resolve(options.outputDir || './output');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  printTerminal(result) {
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('                      📊 变更日志分析报告'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    this.printMeta(result.meta);
    this.printTicketStats(result.statistics.tickets);
    this.printModuleStats(result.statistics.modules);
    this.printRiskStats(result.statistics.risk);
    this.printMissingTickets(result.entries);
    this.printHighRiskEntries(result.entries);

    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }

  printMeta(meta) {
    console.log(chalk.gray(`生成时间: ${new Date(meta.generatedAt).toLocaleString('zh-CN')}`));
    console.log(chalk.gray(`源文件: ${meta.sourceFile}`));
    console.log(`\n📝 总计: ${chalk.bold(meta.totalEntries)} 条变更记录`);
    console.log(`🎫 工单: ${chalk.bold(meta.totalTickets)} 个匹配工单`);
    console.log(`⚠️  无工单: ${chalk.bold(meta.entriesWithoutTickets)} 条记录`);
    console.log('');
  }

  printTicketStats(tickets) {
    console.log(chalk.bold('🎫 工单统计'));
    console.log('  ──────────────────────────────────────────');
    console.log(`  工单总数:     ${chalk.cyan(tickets.total)}`);
    console.log(`  有工单记录:   ${chalk.green(tickets.withTickets)}`);
    console.log(`  无工单记录:   ${tickets.withoutTickets > 0 ? chalk.yellow(tickets.withoutTickets) : chalk.green(tickets.withoutTickets)}`);
    console.log(`  覆盖率:       ${chalk.bold(((tickets.withTickets / (tickets.withTickets + tickets.withoutTickets)) * 100).toFixed(1))}%`);
    console.log('');
  }

  printModuleStats(modules) {
    console.log(chalk.bold('📦 模块分布'));
    console.log('  ──────────────────────────────────────────');

    const sorted = Object.entries(modules).sort((a, b) => b[1].count - a[1].count);

    if (sorted.length === 0) {
      console.log(chalk.gray('  未识别到模块'));
    } else {
      for (const [name, data] of sorted) {
        const bar = '█'.repeat(Math.min(data.count * 2, 20));
        const owner = data.owner ? ` (${data.owner})` : '';
        console.log(`  ${name.padEnd(12)} ${chalk.blue(bar.padEnd(20))} ${data.count}条${owner}`);
      }
    }
    console.log('');
  }

  printRiskStats(risk) {
    console.log(chalk.bold('⚠️  风险分级'));
    console.log('  ──────────────────────────────────────────');
    console.log(`  🔴 高危:  ${risk.high.count > 0 ? chalk.red.bold(risk.high.count) : chalk.green(0)} 条`);
    console.log(`  🟡 中危:  ${risk.medium.count > 0 ? chalk.yellow.bold(risk.medium.count) : chalk.green(0)} 条`);
    console.log(`  🟢 低危:  ${risk.low.count > 0 ? chalk.blue(risk.low.count) : chalk.green(0)} 条`);
    console.log(`  ✅ 安全:  ${chalk.green(risk.none.count)} 条`);
    console.log('');
  }

  printMissingTickets(entries) {
    const missing = entries.filter(e => e.ticketCount === 0);
    if (missing.length === 0) return;

    console.log(chalk.yellow.bold('⚠️  无工单变更记录 (请尽快补充)'));
    console.log('  ──────────────────────────────────────────');

    missing.slice(0, 5).forEach(entry => {
      const content = entry.content.length > 50 ? entry.content.substring(0, 50) + '...' : entry.content;
      console.log(`  [第${entry.lineNumber}行] ${chalk.gray(content)}`);
    });

    if (missing.length > 5) {
      console.log(chalk.gray(`  ... 还有 ${missing.length - 5} 条，请查看完整报告`));
    }
    console.log('');
  }

  printHighRiskEntries(entries) {
    const highRisk = entries.filter(e => e.risk.level === 'high');
    if (highRisk.length === 0) return;

    console.log(chalk.red.bold('🔴 高危变更记录 (需重点关注)'));
    console.log('  ──────────────────────────────────────────');

    highRisk.slice(0, 3).forEach(entry => {
      const content = entry.content.length > 60 ? entry.content.substring(0, 60) + '...' : entry.content;
      const keywords = entry.risk.matches.high.map(m => m.keyword).join(', ');
      console.log(`  [第${entry.lineNumber}行] ${chalk.red(content)}`);
      console.log(`             风险关键词: ${chalk.red.bold(keywords)}`);
    });

    if (highRisk.length > 3) {
      console.log(chalk.gray(`  ... 还有 ${highRisk.length - 3} 条，请查看完整报告`));
    }
    console.log('');
  }

  async writeJson(result) {
    const filename = config.get('output.jsonFilename') || 'changelog-analysis.json';
    const filePath = path.join(this.outputDir, filename);

    const jsonContent = JSON.stringify(result, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    console.log(chalk.green(`📄 JSON 报告已生成: ${filePath}`));
    return filePath;
  }

  async writeMarkdown(result) {
    const filename = config.get('output.markdownFilename') || 'changelog-report.md';
    const filePath = path.join(this.outputDir, filename);

    const content = this.generateMarkdown(result);
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(chalk.green(`📑 Markdown 报告已生成: ${filePath}`));
    return filePath;
  }

  generateMarkdown(result) {
    const lines = [];

    lines.push('# 📊 变更日志分析报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date(result.meta.generatedAt).toLocaleString('zh-CN')}`);
    lines.push(`> 源文件: \`${result.meta.sourceFile}\``);
    lines.push('');

    lines.push('## 📋 概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 变更记录总数 | ${result.meta.totalEntries} |`);
    lines.push(`| 匹配工单总数 | ${result.meta.totalTickets} |`);
    lines.push(`| 无工单记录数 | ${result.meta.entriesWithoutTickets} |`);
    lines.push(`| 工单覆盖率 | ${result.meta.totalEntries > 0 ? (((result.meta.totalEntries - result.meta.entriesWithoutTickets) / result.meta.totalEntries) * 100).toFixed(1) : 0}% |`);
    lines.push('');

    lines.push('## 🎫 工单统计');
    lines.push('');
    lines.push(`- **有工单记录**: ${result.statistics.tickets.withTickets}`);
    lines.push(`- **无工单记录**: ${result.statistics.tickets.withoutTickets}`);
    lines.push(`- **工单总数**: ${result.statistics.tickets.total}`);
    lines.push('');

    lines.push('## 📦 模块分布');
    lines.push('');
    const sortedModules = Object.entries(result.statistics.modules).sort((a, b) => b[1].count - a[1].count);
    if (sortedModules.length > 0) {
      lines.push('| 模块 | 数量 | 负责人 |');
      lines.push('|------|------|--------|');
      for (const [name, data] of sortedModules) {
        const owner = data.owner || '-';
        lines.push(`| ${name} | ${data.count} | ${owner} |`);
      }
    } else {
      lines.push('_未识别到模块_');
    }
    lines.push('');

    lines.push('## ⚠️ 风险分级');
    lines.push('');
    lines.push('| 等级 | 数量 | 说明 |');
    lines.push('|------|------|------|');
    lines.push(`| 🔴 高危 | ${result.statistics.risk.high.count} | 需立即关注 |`);
    lines.push(`| 🟡 中危 | ${result.statistics.risk.medium.count} | 需重点关注 |`);
    lines.push(`| 🟢 低危 | ${result.statistics.risk.low.count} | 常规关注 |`);
    lines.push(`| ✅ 安全 | ${result.statistics.risk.none.count} | 无风险 |`);
    lines.push('');

    lines.push('## 🔴 高危变更记录');
    lines.push('');
    const highRiskEntries = result.entries.filter(e => e.risk.level === 'high');
    if (highRiskEntries.length > 0) {
      lines.push('| 行号 | 内容 | 风险关键词 | 负责人 |');
      lines.push('|------|------|------------|--------|');
      for (const entry of highRiskEntries) {
        const keywords = entry.risk.matches.high.map(m => `\`${m.keyword}\``).join(', ');
        const owner = entry.modules.primary[0]?.owner || '-';
        lines.push(`| ${entry.lineNumber} | ${entry.content.replace(/\|/g, '\\|')} | ${keywords} | ${owner} |`);
      }
    } else {
      lines.push('_无高危变更记录_');
    }
    lines.push('');

    lines.push('## ⚠️ 无工单变更记录');
    lines.push('');
    const missingTickets = result.entries.filter(e => e.ticketCount === 0);
    if (missingTickets.length > 0) {
      lines.push('| 行号 | 内容 | 模块 | 风险等级 |');
      lines.push('|------|------|------|----------|');
      for (const entry of missingTickets) {
        const modules = entry.modules.primary.map(m => m.name).join(', ') || '-';
        const riskLevel = this.getRiskLevelLabel(entry.risk.level);
        lines.push(`| ${entry.lineNumber} | ${entry.content.replace(/\|/g, '\\|')} | ${modules} | ${riskLevel} |`);
      }
    } else {
      lines.push('_所有变更记录均有工单_ 🎉');
    }
    lines.push('');

    lines.push('## 📝 详细变更记录');
    lines.push('');
    for (const entry of result.entries) {
      const ticketLinks = entry.tickets.flatMap(t => t.matches.map(m => `[${m.id}](${m.url})`)).join(', ') || '_无_';
      const modules = entry.modules.primary.map(m => `**${m.name}**`).join(', ') || '_未识别_';
      const riskLevel = this.getRiskLevelLabel(entry.risk.level);
      const owner = entry.modules.primary[0]?.owner || '-';

      lines.push(`### 第 ${entry.lineNumber} 行`);
      lines.push('');
      lines.push(`> ${entry.content}`);
      lines.push('');
      lines.push(`- **工单**: ${ticketLinks}`);
      lines.push(`- **模块**: ${modules}`);
      lines.push(`- **负责人**: ${owner}`);
      lines.push(`- **风险等级**: ${riskLevel}`);
      lines.push(`- **风险说明**: ${entry.risk.explanation}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('_本报告由 changelog-ticket-cli 自动生成_');

    return lines.join('\n');
  }

  getRiskLevelLabel(level) {
    const labels = {
      high: '🔴 高危',
      medium: '🟡 中危',
      low: '🟢 低危',
      none: '✅ 安全'
    };
    return labels[level] || level;
  }
}

module.exports = Reporter;
