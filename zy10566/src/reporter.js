const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { DateTime } = require('luxon');

class Reporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'reports';
    this.colors = options.colors !== false;
  }

  generateConsoleSummary(auditResult) {
    if (!auditResult.success) {
      console.log(chalk.red(`❌ 审计失败: ${auditResult.error}`));
      return;
    }

    const { summary, input } = auditResult;

    console.log('\n' + chalk.bold.blue('='.repeat(70)));
    console.log(chalk.bold.blue('           Cron 时区巡检报告 - 摘要'));
    console.log(chalk.bold.blue('='.repeat(70)) + '\n');

    console.log(chalk.bold('📊 总体统计'));
    const statsTable = new Table({
      head: ['指标', '数值'],
      colWidths: [40, 28]
    });
    statsTable.push(['总任务数', summary.totalTasks]);
    statsTable.push(['有效任务', this.colorize(summary.validTasks, 'green')]);
    statsTable.push(['无效/坏数据', this.colorize(summary.invalidTasks, summary.invalidTasks > 0 ? 'red' : 'green')]);
    statsTable.push(['发现异常任务', this.colorize(summary.tasksWithAnomalies, summary.tasksWithAnomalies > 0 ? 'yellow' : 'green')]);
    statsTable.push(['解析错误', this.colorize(summary.parseErrors, summary.parseErrors > 0 ? 'red' : 'green')]);
    statsTable.push(['检查时区数', summary.timezonesChecked]);
    statsTable.push(['发现DST切换', summary.dstTransitionsFound]);
    console.log(statsTable.toString() + '\n');

    if (input.badLines && input.badLines.length > 0) {
      console.log(chalk.bold('⚠️  坏数据记录'));
      const badTable = new Table({
        head: ['行号', '原因', '原始内容'],
        colWidths: [8, 25, 35]
      });
      input.badLines.slice(0, 5).forEach(line => {
        badTable.push([
          line.lineNumber,
          line.reason,
          line.raw.substring(0, 30) + (line.raw.length > 30 ? '...' : '')
        ]);
      });
      console.log(badTable.toString());
      if (input.badLines.length > 5) {
        console.log(chalk.gray(`  ... 还有 ${input.badLines.length - 5} 条坏数据\n`));
      }
      console.log('');
    }

    console.log(chalk.bold('🔍 异常类型统计'));
    const anomalyTable = new Table({
      head: ['异常类型', '数量', '说明'],
      colWidths: [20, 10, 38]
    });
    const anomalyTypes = {
      'hour-shift': ['执行小时偏移', '夏令时导致执行时间变化'],
      'missing-run': ['任务丢失', '夏令时跳过时任务被跳过'],
      'duplicate-run': ['任务重复', '冬令时回拨任务重复执行'],
      'other': ['其他', '其他类型异常']
    };
    Object.entries(summary.anomalyBreakdown).forEach(([type, count]) => {
      const [name, desc] = anomalyTypes[type] || [type, '未知类型'];
      anomalyTable.push([
        name,
        this.colorize(count, count > 0 ? 'yellow' : 'green'),
        desc
      ]);
    });
    console.log(anomalyTable.toString() + '\n');

    if (auditResult.results.anomalies.length > 0) {
      console.log(chalk.bold('🚨 异常任务清单 (Top 10)'));
      const anomalyListTable = new Table({
        head: ['#', '任务名称', 'Cron', '时区', '严重性', '异常'],
        colWidths: [5, 20, 18, 22, 10, 25]
      });
      auditResult.results.anomalies.slice(0, 10).forEach((task, idx) => {
        const maxSeverity = Math.max(...task.anomalies.map(a => {
          if (a.severity === 'critical') return 3;
          if (a.severity === 'high') return 2;
          return 1;
        }));
        const severityLabel = maxSeverity === 3 ? '严重' : maxSeverity === 2 ? '高' : '中';
        const anomalyMessages = task.anomalies.map(a => a.message).join('; ').substring(0, 22);
        anomalyListTable.push([
          idx + 1,
          task.taskName.substring(0, 18),
          task.cronExpression.substring(0, 16),
          task.timezone,
          this.colorizeSeverity(severityLabel, maxSeverity),
          anomalyMessages + (task.anomalies.length > 1 ? '...' : '')
        ]);
      });
      console.log(anomalyListTable.toString() + '\n');
    }

    console.log(chalk.bold('🌍 时区分布'));
    const tzTable = new Table({
      head: ['时区', '任务数', '相关服务'],
      colWidths: [30, 10, 28]
    });
    summary.timezoneStats.forEach(stat => {
      tzTable.push([
        stat.timezone,
        stat.taskCount,
        stat.services.slice(0, 2).join(', ') + (stat.services.length > 2 ? ` +${stat.services.length - 2}` : '')
      ]);
    });
    console.log(tzTable.toString() + '\n');

    const hasIssues = summary.tasksWithAnomalies > 0 || summary.invalidTasks > 0 || summary.parseErrors > 0;
    if (hasIssues) {
      console.log(chalk.yellow('⚠️  发现问题！请查看完整报告文件了解详情。\n'));
    } else {
      console.log(chalk.green('✅ 所有任务检查通过！\n'));
    }
  }

  colorize(value, color) {
    if (!this.colors) return String(value);
    return chalk[color](value);
  }

  colorizeSeverity(label, level) {
    if (!this.colors) return label;
    if (level === 3) return chalk.red(label);
    if (level === 2) return chalk.yellow(label);
    return chalk.blue(label);
  }

  generateJsonReport(auditResult, filename = 'audit-result.json') {
    const outputPath = path.join(this.outputDir, filename);
    this.ensureOutputDir();
    
    fs.writeFileSync(
      outputPath,
      JSON.stringify(auditResult, null, 2),
      'utf-8'
    );
    
    console.log(chalk.gray(`📄 JSON报告已保存: ${outputPath}`));
    return outputPath;
  }

  generateMarkdownReport(auditResult, filename = 'audit-report.md') {
    const outputPath = path.join(this.outputDir, filename);
    this.ensureOutputDir();

    const { summary, input, dstTransitions, results } = auditResult;
    const generatedDate = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss');

    let md = `# Cron 时区巡检报告\n\n`;
    md += `> 生成时间: ${generatedDate}\n>\n`;
    md += `> 审计周期: ${DateTime.fromISO(summary.auditPeriod.start).toFormat('yyyy-MM-dd')} 至 ${DateTime.fromISO(summary.auditPeriod.end).toFormat('yyyy-MM-dd')}\n\n`;

    md += `## 📊 总体统计\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总任务数 | ${summary.totalTasks} |\n`;
    md += `| 有效任务 | ${summary.validTasks} |\n`;
    md += `| 无效/坏数据 | ${summary.invalidTasks} |\n`;
    md += `| 发现异常任务 | ${summary.tasksWithAnomalies} |\n`;
    md += `| 解析错误 | ${summary.parseErrors} |\n`;
    md += `| 检查时区数 | ${summary.timezonesChecked} |\n`;
    md += `| 发现DST切换 | ${summary.dstTransitionsFound} |\n\n`;

    if (input.badLines && input.badLines.length > 0) {
      md += `## ⚠️ 坏数据记录\n\n`;
      md += `| 行号 | 原因 | 原始内容 |\n`;
      md += `|------|------|----------|\n`;
      input.badLines.forEach(line => {
        md += `| ${line.lineNumber} | ${line.reason} | \`${line.raw.replace(/\|/g, '\\|')}\` |\n`;
      });
      md += `\n`;
    }

    md += `## 🔍 异常类型统计\n\n`;
    md += `| 异常类型 | 数量 | 说明 |\n`;
    md += `|----------|------|------|\n`;
    const anomalyLabels = {
      'hour-shift': ['执行小时偏移', '夏令时导致执行时间变化'],
      'missing-run': ['任务丢失', '夏令时跳过时任务被跳过'],
      'duplicate-run': ['任务重复', '冬令时回拨任务重复执行'],
      'other': ['其他', '其他类型异常']
    };
    Object.entries(summary.anomalyBreakdown).forEach(([type, count]) => {
      const [name, desc] = anomalyLabels[type] || [type, '未知类型'];
      md += `| ${name} | ${count} | ${desc} |\n`;
    });
    md += `\n`;

    if (dstTransitions.length > 0) {
      md += `## 🔄 夏令时切换时间表\n\n`;
      md += `| 时区 | 类型 | 本地时间 | UTC时间 | 偏移变化 |\n`;
      md += `|------|------|----------|---------|----------|\n`;
      dstTransitions.forEach(t => {
        const typeLabel = t.type === 'spring-forward' ? '夏令时开始 ⬆️' : '冬令时开始 ⬇️';
        md += `| ${t.timezone} | ${typeLabel} | ${DateTime.fromISO(t.datetime).toFormat('yyyy-MM-dd HH:mm')} | ${DateTime.fromISO(t.utcDatetime).toFormat('yyyy-MM-dd HH:mm')} | ${t.offsetChange > 0 ? '+' : ''}${t.offsetChange / 60}小时 |\n`;
      });
      md += `\n`;
    }

    if (results.anomalies.length > 0) {
      md += `## 🚨 异常任务详情\n\n`;
      results.anomalies.forEach(task => {
        md += `### ${task.taskName}\n\n`;
        md += `- **行号**: ${task.lineNumber}\n`;
        md += `- **Cron表达式**: \`${task.cronExpression}\`\n`;
        md += `- **时区**: ${task.timezone}\n`;
        if (task.service) md += `- **服务**: ${task.service}\n`;
        if (task.owner) md += `- **负责人**: ${task.owner}\n`;
        if (task.description) md += `- **描述**: ${task.description}\n`;
        md += `\n`;
        
        md += `#### 异常问题:\n\n`;
        task.anomalies.forEach((anomaly, idx) => {
          const severityLabel = anomaly.severity === 'critical' ? '🔴 严重' : anomaly.severity === 'high' ? '🟡 高' : '🟢 中';
          md += `${idx + 1}. **${severityLabel} - ${anomaly.message}**\n`;
          md += `   - 切换类型: ${anomaly.transition === 'spring-forward' ? '夏令时开始' : '冬令时开始'}\n`;
          md += `   - 切换时间: ${DateTime.fromISO(anomaly.transitionDate).toFormat('yyyy-MM-dd')}\n`;
        });
        md += `\n---\n\n`;
      });
    }

    md += `## 🌍 时区分布\n\n`;
    md += `| 时区 | 任务数 | 相关服务 |\n`;
    md += `|------|--------|----------|\n`;
    summary.timezoneStats.forEach(stat => {
      md += `| ${stat.timezone} | ${stat.taskCount} | ${stat.services.join(', ') || '-'} |\n`;
    });
    md += `\n`;

    if (results.allTasks.length > 0) {
      md += `## 📋 所有任务清单\n\n`;
      md += `| # | 任务名称 | Cron表达式 | 时区 | 状态 |\n`;
      md += `|---|----------|------------|------|------|\n`;
      results.allTasks.forEach((task, idx) => {
        const status = task.hasAnomalies ? '⚠️ 异常' : task.valid ? '✅ 正常' : '❌ 无效';
        md += `| ${idx + 1} | ${task.taskName} | \`${task.cronExpression}\` | ${task.timezone} | ${status} |\n`;
      });
      md += `\n`;
    }

    fs.writeFileSync(outputPath, md, 'utf-8');
    console.log(chalk.gray(`📄 Markdown报告已保存: ${outputPath}`));
    return outputPath;
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateAllReports(auditResult) {
    this.ensureOutputDir();
    
    const timestamp = DateTime.now().toFormat('yyyyMMdd-HHmmss');
    
    this.generateConsoleSummary(auditResult);
    this.generateJsonReport(auditResult, `audit-result-${timestamp}.json`);
    this.generateMarkdownReport(auditResult, `audit-report-${timestamp}.md`);
    
    return {
      json: path.join(this.outputDir, `audit-result-${timestamp}.json`),
      markdown: path.join(this.outputDir, `audit-report-${timestamp}.md`)
    };
  }
}

module.exports = { Reporter };
