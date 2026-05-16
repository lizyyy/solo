import { AuditBatch, AuditReport, OutputFormat, AuditRecord } from './types';
import { getRuleByVersion } from './rules';
import * as fs from 'fs';
import * as path from 'path';

function buildReport(batch: AuditBatch): AuditReport {
  const rule = getRuleByVersion(batch.ruleVersion);
  
  const beforeAfterComparison = batch.records
    .filter(r => r.afterData)
    .map(r => ({
      sampleNo: r.sampleNo,
      before: {
        sampleNo: r.beforeData.sampleNo,
        status: r.beforeData.status,
        gatewayError: r.beforeData.gatewayError
      },
      after: {
        sampleNo: r.afterData!.sampleNo,
        status: r.afterData!.status,
        gatewayError: r.afterData!.gatewayError
      }
    }));
  
  const summaries = batch.records
    .filter(r => r.beforeData.gatewayError)
    .map(record => ({
      sampleNo: record.sampleNo,
      exception: record.beforeData.gatewayError || '未知异常',
      correction: '已清除网关错误标记，样本状态重置为待检测，建议重新提交或人工复核',
      conclusion: '样本数据本身有效，仅为传输层问题，修正后可继续正常处理流程'
    }));
  
  return {
    batchId: batch.batchId,
    ruleVersion: batch.ruleVersion,
    ruleDescription: rule?.description || '未知规则',
    executionTime: new Date(batch.startTime).toLocaleString('zh-CN'),
    executionTimeMs: batch.executionTimeMs,
    statistics: {
      total: batch.totalCount,
      success: batch.successCount,
      warning: batch.warningCount,
      failed: batch.failedCount
    },
    beforeAfterComparison,
    summaries,
    nextSteps: batch.nextSteps
  };
}

export function outputJSON(batch: AuditBatch): string {
  const report = buildReport(batch);
  return JSON.stringify(report, null, 2);
}

export function outputMarkdown(batch: AuditBatch): string {
  const report = buildReport(batch);
  
  let md = `# 批量脚本执行审计报告\n\n`;
  
  md += `## 基本信息\n\n`;
  md += `- **批次ID**: ${report.batchId}\n`;
  md += `- **规则版本**: ${report.ruleVersion}\n`;
  md += `- **规则说明**: ${report.ruleDescription}\n`;
  md += `- **执行时间**: ${report.executionTime}\n`;
  md += `- **执行耗时**: ${report.executionTimeMs}ms\n\n`;
  
  md += `## 统计概览\n\n`;
  md += `| 状态 | 数量 | 占比 |\n`;
  md += `|------|------|------|\n`;
  md += `| 成功 | ${report.statistics.success} | ${((report.statistics.success / report.statistics.total) * 100).toFixed(1)}% |\n`;
  md += `| 警告 | ${report.statistics.warning} | ${((report.statistics.warning / report.statistics.total) * 100).toFixed(1)}% |\n`;
  md += `| 失败 | ${report.statistics.failed} | ${((report.statistics.failed / report.statistics.total) * 100).toFixed(1)}% |\n`;
  md += `| **总计** | **${report.statistics.total}** | **100%** |\n\n`;
  
  if (report.summaries.length > 0) {
    md += `## 异常修正摘要\n\n`;
    report.summaries.forEach(summary => {
      md += `### 样本号: ${summary.sampleNo}\n\n`;
      md += `- **异常**: ${summary.exception}\n`;
      md += `- **修正**: ${summary.correction}\n`;
      md += `- **结论**: ${summary.conclusion}\n\n`;
    });
  }
  
  if (report.beforeAfterComparison.length > 0) {
    md += `## 处理前后对比\n\n`;
    report.beforeAfterComparison.forEach(item => {
      md += `### 样本号: ${item.sampleNo}\n\n`;
      md += `#### 处理前\n\n`;
      md += `\`\`\`json\n${JSON.stringify(item.before, null, 2)}\n\`\`\`\n\n`;
      md += `#### 处理后\n\n`;
      md += `\`\`\`json\n${JSON.stringify(item.after, null, 2)}\n\`\`\`\n\n`;
    });
  }
  
  md += `## 下一步建议\n\n`;
  report.nextSteps.forEach((step, index) => {
    md += `${index + 1}. ${step}\n`;
  });
  md += `\n`;
  
  if (batch.failedItems.length > 0) {
    md += `## 失败项目清单\n\n`;
    md += `> 详细失败原因和原始数据请参考独立保存的失败项文件\n\n`;
    batch.failedItems.forEach(item => {
      md += `- **样本号**: ${item.sampleNo}\n`;
      md += `  - 错误数量: ${item.errors.length}\n`;
      md += `  - 建议: ${item.suggestion}\n`;
    });
    md += `\n`;
  }
  
  return md;
}

export function saveFailedItems(batch: AuditBatch, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, `${batch.batchId}_failed_items.json`);
  const content = JSON.stringify(batch.failedItems, null, 2);
  
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export function saveReport(
  batch: AuditBatch,
  format: OutputFormat,
  outputDir: string
): { reportPath: string; failedItemsPath?: string } {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const result: { reportPath: string; failedItemsPath?: string } = {
    reportPath: ''
  };
  
  let content: string;
  let fileName: string;
  
  switch (format) {
    case 'json':
      content = outputJSON(batch);
      fileName = `${batch.batchId}_report.json`;
      break;
    case 'markdown':
      content = outputMarkdown(batch);
      fileName = `${batch.batchId}_report.md`;
      break;
    case 'download':
      content = outputJSON(batch);
      fileName = `${batch.batchId}_download.json`;
      break;
    default:
      throw new Error(`不支持的输出格式: ${format}`);
  }
  
  const reportPath = path.join(outputDir, fileName);
  fs.writeFileSync(reportPath, content, 'utf8');
  result.reportPath = reportPath;
  
  if (batch.failedItems.length > 0) {
    result.failedItemsPath = saveFailedItems(batch, outputDir);
  }
  
  return result;
}

export function formatConsoleOutput(batch: AuditBatch): string {
  const chalk = require('chalk');
  let output = '';
  
  output += chalk.bold.blue('\n╔══════════════════════════════════════════════════════════╗\n');
  output += chalk.bold.blue('║              批量脚本执行审计结果汇总                      ║\n');
  output += chalk.bold.blue('╚══════════════════════════════════════════════════════════╝\n\n');
  
  output += `批次ID: ${chalk.cyan(batch.batchId)}\n`;
  output += `规则版本: ${chalk.magenta(batch.ruleVersion)}\n`;
  output += `执行耗时: ${chalk.yellow(`${batch.executionTimeMs}ms`)}\n\n`;
  
  output += chalk.bold('统计结果:\n');
  output += `  成功: ${chalk.green(batch.successCount)}\n`;
  output += `  警告: ${chalk.yellow(batch.warningCount)}\n`;
  output += `  失败: ${chalk.red(batch.failedCount)}\n`;
  output += `  总计: ${batch.totalCount}\n\n`;
  
  if (batch.failedItems.length > 0) {
    output += chalk.red.bold('失败样本清单:\n');
    batch.failedItems.forEach(item => {
      output += `  - ${item.sampleNo}: ${item.errors[0].message}\n`;
    });
    output += '\n';
  }
  
  output += chalk.bold('下一步建议:\n');
  batch.nextSteps.slice(0, 3).forEach((step, index) => {
    output += `  ${index + 1}. ${step}\n`;
  });
  
  return output;
}

export function queryRecords(
  batch: AuditBatch,
  filters: {
    status?: 'success' | 'warning' | 'failed';
    sampleNo?: string;
    ruleId?: string;
  }
): AuditRecord[] {
  let results = batch.records;
  
  if (filters.status) {
    results = results.filter(r => r.overallStatus === filters.status);
  }
  
  if (filters.sampleNo) {
    results = results.filter(r => r.sampleNo.includes(filters.sampleNo!));
  }
  
  if (filters.ruleId) {
    results = results.filter(r => r.checks.some(c => c.ruleId === filters.ruleId && !c.result.passed));
  }
  
  return results;
}
