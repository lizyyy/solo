const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');
const chalk = require('chalk');

class ReportGenerator {
  constructor(outputDir = './output') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)} 秒`;
    return `${(ms / 60000).toFixed(2)} 分钟`;
  }

  generateComparisonTable(before, after) {
    const table = new Table({
      head: ['指标', '处理前', '处理后', '变化'],
      colWidths: [20, 20, 20, 20]
    });

    const fileDiff = after.totalFiles - before.totalFiles;
    const sizeDiff = after.totalSize - before.totalSize;

    table.push(
      ['文件总数', before.totalFiles, after.totalFiles, 
        fileDiff >= 0 ? `+${fileDiff}` : fileDiff],
      ['总大小', this.formatSize(before.totalSize), 
        this.formatSize(after.totalSize),
        sizeDiff >= 0 ? `+${this.formatSize(sizeDiff)}` : `-${this.formatSize(-sizeDiff)}`]
    );

    return table.toString();
  }

  generateCandidateTable(candidates) {
    if (candidates.length === 0) {
      return '无候选文件';
    }

    const table = new Table({
      head: ['序号', '路径', '大小', '状态'],
      colWidths: [8, 50, 15, 15]
    });

    candidates.forEach((item, idx) => {
      table.push([
        idx + 1,
        item.path.length > 47 ? '...' + item.path.slice(-47) : item.path,
        this.formatSize(item.size),
        item.isProtected ? chalk.yellow('受保护') : chalk.green('可清理')
      ]);
    });

    return table.toString();
  }

  generateFailedItemsTable(failedItems) {
    if (failedItems.length === 0) {
      return '无失败项';
    }

    const table = new Table({
      head: ['序号', '路径', '原因', '时间'],
      colWidths: [8, 40, 30, 25]
    });

    failedItems.forEach((item, idx) => {
      table.push([
        idx + 1,
        item.path.length > 37 ? '...' + item.path.slice(-37) : item.path,
        item.reason,
        item.timestamp
      ]);
    });

    return table.toString();
  }

  generateBoundaryTable(boundaryResults) {
    if (boundaryResults.length === 0) {
      return '无边界处理记录';
    }

    const table = new Table({
      head: ['序号', '路径', '动作', '原因'],
      colWidths: [8, 45, 15, 30]
    });

    boundaryResults.forEach((item, idx) => {
      table.push([
        idx + 1,
        item.path.length > 42 ? '...' + item.path.slice(-42) : item.path,
        item.action,
        item.reason
      ]);
    });

    return table.toString();
  }

  generateNextSteps(cleanResult, validationReport) {
    const steps = [];

    if (cleanResult.dryRun) {
      steps.push({
        step: 1,
        action: '确认预览结果',
        detail: '检查候选清单无误后，添加 --no-dry-run 执行实际清理'
      });
    }

    if (cleanResult.failedCount > 0) {
      steps.push({
        step: steps.length + 1,
        action: '处理失败项',
        detail: `查看 ${this.outputDir}/failed-items.json 了解详情，手动处理后重新执行`
      });
    }

    if (validationReport && validationReport.validationResult) {
      const { errors, missingCombinations } = validationReport.validationResult;
      if (errors.length > 0 || missingCombinations.length > 0) {
        steps.push({
          step: steps.length + 1,
          action: '修复参数问题',
          detail: '根据验证报告补充必要参数，确保操作安全执行'
        });
      }
    }

    steps.push({
      step: steps.length + 1,
      action: '保存审计日志',
      detail: '将操作记录归档到版本仓库，关联责任团队交接单'
    });

    steps.push({
      step: steps.length + 1,
      action: '验证清理效果',
      detail: '确认目标缓存已清理，系统功能正常运行'
    });

    return steps;
  }

  generateFullReport(cleanResult, candidates, failedItems, boundaryResults, validationReport, inputContext) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.outputDir, `clean-report-${timestamp}.md`);

    let reportContent = `# 缓存清理执行报告\n\n`;
    reportContent += `## 基本信息\n`;
    reportContent += `- 执行时间: ${new Date().toLocaleString()}\n`;
    reportContent += `- 执行模式: ${cleanResult.dryRun ? '预览模式 (dry-run)' : '真实执行'}\n`;
    reportContent += `- 执行耗时: ${this.formatDuration(cleanResult.duration)}\n\n`;

    if (inputContext) {
      reportContent += `## 输入背景\n`;
      reportContent += `\`\`\`\n${inputContext}\n\`\`\`\n\n`;
    }

    reportContent += `## 处理前后对比\n\n`;
    reportContent += this.generateComparisonTable(cleanResult.beforeStats, cleanResult.afterStats);
    reportContent += '\n\n';

    reportContent += `## 执行摘要\n`;
    reportContent += `- 候选文件总数: ${candidates.length}\n`;
    reportContent += `- 已清理文件数: ${cleanResult.cleanedCount}\n`;
    reportContent += `- 失败文件数: ${cleanResult.failedCount}\n`;
    reportContent += `- 边界处理数: ${boundaryResults.length}\n\n`;

    reportContent += `## 候选清单\n\n`;
    reportContent += this.generateCandidateTable(candidates);
    reportContent += '\n\n';

    reportContent += `## 失败项详情\n\n`;
    reportContent += this.generateFailedItemsTable(failedItems);
    reportContent += '\n\n';

    reportContent += `## 边界输入处理结果\n\n`;
    reportContent += this.generateBoundaryTable(boundaryResults);
    reportContent += '\n\n';

    if (validationReport) {
      reportContent += `## 参数验证与拦截说明\n\n`;
      reportContent += validationReport.blockedExplanation;
      reportContent += '\n\n';
    }

    const nextSteps = this.generateNextSteps(cleanResult, validationReport);
    reportContent += `## 下一步建议\n\n`;
    nextSteps.forEach(step => {
      reportContent += `### ${step.step}. ${step.action}\n`;
      reportContent += `${step.detail}\n\n`;
    });

    fs.writeFileSync(reportPath, reportContent, 'utf-8');
    return { reportPath, timestamp };
  }

  saveFailedItems(failedItems) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.outputDir, `failed-items-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(failedItems, null, 2), 'utf-8');
    return filePath;
  }

  saveBoundaryResults(boundaryResults) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.outputDir, `boundary-results-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(boundaryResults, null, 2), 'utf-8');
    return filePath;
  }

  saveAuditLog(auditLog) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.outputDir, `audit-log-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(auditLog, null, 2), 'utf-8');
    return filePath;
  }

  saveCandidateList(candidates) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(this.outputDir, `candidate-list-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(candidates, null, 2), 'utf-8');
    return filePath;
  }

  printConsoleSummary(cleanResult, candidates, failedItems, boundaryResults) {
    console.log('\n' + chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan('缓存清理执行摘要'));
    console.log(chalk.cyan('='.repeat(60)) + '\n');

    console.log(chalk.white(`执行模式: ${cleanResult.dryRun ? chalk.yellow('预览模式') : chalk.red('真实执行')}`));
    console.log(chalk.white(`执行耗时: ${this.formatDuration(cleanResult.duration)}`));
    console.log();

    console.log(chalk.green(`✓ 候选文件: ${candidates.length}`));
    console.log(chalk.green(`✓ 已清理: ${cleanResult.cleanedCount}`));
    
    if (failedItems.length > 0) {
      console.log(chalk.red(`✗ 失败项: ${failedItems.length}`));
    }
    if (boundaryResults.length > 0) {
      console.log(chalk.yellow(`⚠ 边界处理: ${boundaryResults.length}`));
    }

    console.log();
    console.log(chalk.cyan('='.repeat(60)) + '\n');
  }
}

module.exports = ReportGenerator;
