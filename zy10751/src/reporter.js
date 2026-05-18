const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class Reporter {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.outputFile = options.outputFile || null;
  }

  generateConsoleReport(summary, detailedRecords = null) {
    const lines = [];
    
    lines.push('');
    lines.push(chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'));
    lines.push(chalk.cyan.bold('║           在线客服排队日志技能组溢出统计报告                   ║'));
    lines.push(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
    lines.push('');

    lines.push(chalk.yellow.bold('【基本信息】'));
    lines.push(`  报告生成时间: ${new Date(summary.generatedAt).toLocaleString()}`);
    lines.push(`  处理文件数: ${summary.filesProcessed.length}`);
    lines.push(`  处理文件: ${summary.filesProcessed.join(', ')}`);
    if (summary.timeRange.start) {
      lines.push(`  时间范围: ${summary.timeRange.start} ~ ${summary.timeRange.end}`);
    }
    lines.push(`  匹配记录总数: ${summary.totalRecords}`);
    lines.push('');

    lines.push(chalk.red.bold('【溢出统计】'));
    lines.push(`  溢出总次数: ${chalk.red.bold(summary.overflowSummary.total)}`);
    if (Object.keys(summary.overflowSummary.bySkillGroup).length > 0) {
      lines.push('  按技能组统计:');
      Object.entries(summary.overflowSummary.bySkillGroup).forEach(([group, count]) => {
        lines.push(`    - ${group}: ${count} 次`);
      });
    }
    lines.push('');

    lines.push(chalk.orange ? chalk.orange.bold('【放弃统计】') : chalk.yellow.bold('【放弃统计】'));
    lines.push(`  放弃总次数: ${chalk.yellow.bold(summary.abandonSummary.total)}`);
    if (Object.keys(summary.abandonSummary.bySkillGroup).length > 0) {
      lines.push('  按技能组统计:');
      Object.entries(summary.abandonSummary.bySkillGroup).forEach(([group, count]) => {
        lines.push(`    - ${group}: ${count} 次`);
      });
    }
    lines.push('');

    lines.push(chalk.blue.bold('【其他事件统计】'));
    lines.push(`  队列占位: ${summary.otherEvents.queueHold} 次`);
    lines.push(`  访客刷新: ${summary.otherEvents.visitorRefresh} 次`);
    lines.push(`  技能组改名: ${summary.otherEvents.skillGroupRename} 次`);
    lines.push('');

    lines.push(chalk.magenta.bold('【特殊事件引用】'));
    lines.push(chalk.gray('  (原始文件名:行号)'));
    
    if (summary.specialEventReferences.queueHold.length > 0) {
      lines.push('  队列占位事件位置:');
      summary.specialEventReferences.queueHold.forEach(ref => {
        lines.push(`    - ${ref}`);
      });
    }
    
    if (summary.specialEventReferences.visitorRefresh.length > 0) {
      lines.push('  访客刷新事件位置:');
      summary.specialEventReferences.visitorRefresh.forEach(ref => {
        lines.push(`    - ${ref}`);
      });
    }
    
    if (summary.specialEventReferences.skillGroupRename.length > 0) {
      lines.push('  技能组改名事件位置:');
      summary.specialEventReferences.skillGroupRename.forEach(ref => {
        lines.push(`    - ${ref}`);
      });
    }
    lines.push('');

    if (this.verbose && detailedRecords) {
      lines.push(chalk.green.bold('【详细记录】'));
      
      if (detailedRecords.queueHold && detailedRecords.queueHold.length > 0) {
        lines.push('');
        lines.push(chalk.green('  [队列占位详细记录]'));
        detailedRecords.queueHold.forEach((record, idx) => {
          lines.push(`    ${idx + 1}. ${record.fileName}:${record.lineNumber}`);
          lines.push(`       时间: ${record.timestamp || '未知'}`);
          lines.push(`       访客ID: ${record.visitorId || '未知'}`);
          lines.push(`       技能组: ${record.skillGroup || '未知'}`);
        });
      }

      if (detailedRecords.visitorRefresh && detailedRecords.visitorRefresh.length > 0) {
        lines.push('');
        lines.push(chalk.green('  [访客刷新详细记录]'));
        detailedRecords.visitorRefresh.forEach((record, idx) => {
          lines.push(`    ${idx + 1}. ${record.fileName}:${record.lineNumber}`);
          lines.push(`       时间: ${record.timestamp || '未知'}`);
          lines.push(`       访客ID: ${record.visitorId || '未知'}`);
        });
      }

      if (detailedRecords.skillGroupRename && detailedRecords.skillGroupRename.length > 0) {
        lines.push('');
        lines.push(chalk.green('  [技能组改名详细记录]'));
        detailedRecords.skillGroupRename.forEach((record, idx) => {
          lines.push(`    ${idx + 1}. ${record.fileName}:${record.lineNumber}`);
          lines.push(`       时间: ${record.timestamp || '未知'}`);
          lines.push(`       内容: ${record.lineContent}`);
        });
      }
      lines.push('');
    }

    lines.push(chalk.cyan('══════════════════════════════════════════════════════════════'));
    lines.push('');

    return lines.join('\n');
  }

  generateJsonReport(summary, detailedRecords = null) {
    const report = {
      ...summary,
      reportType: this.verbose ? 'detailed' : 'summary'
    };
    
    if (this.verbose && detailedRecords) {
      report.detailedRecords = detailedRecords;
    }
    
    return JSON.stringify(report, null, 2);
  }

  async saveReport(content) {
    if (!this.outputFile) return;
    
    const dir = path.dirname(this.outputFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.outputFile, content, 'utf8');
  }

  printConsole(summary, detailedRecords = null) {
    const report = this.generateConsoleReport(summary, detailedRecords);
    console.log(report);
  }
}

module.exports = Reporter;
