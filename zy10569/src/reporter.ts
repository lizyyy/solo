import { ProcessingResult, ErrorGroup, ErrorSample, ParsedLogEntry } from './types';
import chalk from 'chalk';

export function generateTerminalSummary(result: ProcessingResult): string {
  const lines: string[] = [];
  const { summary, errorGroups, invalidEntries } = result;

  lines.push('');
  lines.push(chalk.bold.blue('='.repeat(60)));
  lines.push(chalk.bold.blue('           API 错误样本采集报告'));
  lines.push(chalk.bold.blue('='.repeat(60)));
  lines.push('');

  lines.push(chalk.bold('📊 统计摘要'));
  lines.push(`  总行数: ${summary.totalLines}`);
  lines.push(`  有效条目: ${chalk.green(summary.validEntries)}`);
  lines.push(`  无效条目: ${chalk.yellow(summary.invalidEntries)}`);
  lines.push(`  错误总数: ${chalk.red(summary.totalErrors)}`);
  lines.push(`  唯一错误分组: ${chalk.cyan(summary.uniqueErrorGroups)}`);
  lines.push('');

  if (errorGroups.length > 0) {
    lines.push(chalk.bold('🔴 错误分组详情'));
    lines.push('');
    for (const group of errorGroups) {
      const statusColor = group.statusCode >= 500 ? chalk.red : chalk.yellow;
      lines.push(
        `  [${statusColor(group.statusCode)}] ${chalk.bold(group.method)} ${chalk.cyan(group.path)}`
      );
      lines.push(`     错误类型: ${group.errorType}`);
      lines.push(`     发生次数: ${chalk.bold.red(group.count)}`);
      lines.push(`     采样数量: ${group.samples.length}`);
      if (group.samples.length > 0) {
        const sample = group.samples[0];
        lines.push(`     样本示例: ${chalk.gray(sample.errorMessage.substring(0, 80))}`);
        lines.push(`     Trace ID: ${sample.traceId}`);
        lines.push(`     原始行号: L${sample.originalLine}`);
      }
      lines.push('');
    }
  }

  if (invalidEntries.length > 0) {
    lines.push(chalk.bold('⚠️  无法解析的条目'));
    lines.push('');
    for (const entry of invalidEntries.slice(0, 5)) {
      lines.push(`  L${entry.lineNumber}: ${chalk.yellow(entry.parseError)}`);
      lines.push(`     ${chalk.gray(entry.raw.substring(0, 100))}`);
    }
    if (invalidEntries.length > 5) {
      lines.push(`  ... 还有 ${invalidEntries.length - 5} 条无法解析的记录`);
    }
    lines.push('');
  }

  lines.push(chalk.bold.blue('='.repeat(60)));
  lines.push(`生成时间: ${result.generatedAt}`);
  lines.push('');

  return lines.join('\n');
}

export function generateMarkdownReport(result: ProcessingResult): string {
  const lines: string[] = [];
  const { summary, errorGroups, invalidEntries, config } = result;

  lines.push('# API 错误样本采集报告');
  lines.push('');
  lines.push(`**生成时间**: ${result.generatedAt}`);
  lines.push('');

  lines.push('## 📊 统计摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总行数 | ${summary.totalLines} |`);
  lines.push(`| 有效条目 | ${summary.validEntries} |`);
  lines.push(`| 无效条目 | ${summary.invalidEntries} |`);
  lines.push(`| 错误总数 | ${summary.totalErrors} |`);
  lines.push(`| 唯一错误分组 | ${summary.uniqueErrorGroups} |`);
  lines.push('');

  lines.push('## ⚙️ 采样配置');
  lines.push('');
  lines.push(`- 每分组最大采样数: ${config.maxSamplesPerGroup}`);
  lines.push(`- 包含请求体: ${config.includeRequest ? '是' : '否'}`);
  lines.push(`- 包含响应体: ${config.includeResponse ? '是' : '否'}`);
  lines.push(`- 敏感字段脱敏: ${config.sensitiveFields.length > 0 ? config.sensitiveFields.join(', ') : '无'}`);
  lines.push('');

  if (errorGroups.length > 0) {
    lines.push('## 🔴 错误分组详情');
    lines.push('');

    for (const group of errorGroups) {
      lines.push(`### [${group.statusCode}] ${group.method} ${group.path}`);
      lines.push('');
      lines.push(`- **错误类型**: ${group.errorType}`);
      lines.push(`- **发生次数**: ${group.count}`);
      lines.push(`- **采样数量**: ${group.samples.length}`);
      lines.push('');

      lines.push('#### 样本详情');
      lines.push('');
      for (const sample of group.samples) {
        lines.push(`##### 样本 \`${sample.id}\``);
        lines.push('');
        lines.push(`- **时间**: ${sample.timestamp}`);
        lines.push(`- **Trace ID**: \`${sample.traceId}\``);
        lines.push(`- **原始行号**: L${sample.originalLine}`);
        lines.push(`- **错误信息**: ${sample.errorMessage}`);
        if (sample.duration) {
          lines.push(`- **响应时间**: ${sample.duration}ms`);
        }
        if (sample.userId) {
          lines.push(`- **用户ID**: ${sample.userId}`);
        }
        lines.push('');

        if (config.includeRequest && sample.requestBody) {
          lines.push('**请求体**:');
          lines.push('```json');
          lines.push(sample.requestBody);
          lines.push('```');
          lines.push('');
        }

        if (config.includeResponse && sample.responseBody) {
          lines.push('**响应体**:');
          lines.push('```json');
          lines.push(sample.responseBody);
          lines.push('```');
          lines.push('');
        }
      }
    }
  }

  if (invalidEntries.length > 0) {
    lines.push('## ⚠️ 无法解析的条目');
    lines.push('');
    lines.push('| 行号 | 错误原因 | 原始内容 |');
    lines.push('|------|----------|----------|');
    for (const entry of invalidEntries) {
      const rawContent = entry.raw.replace(/\|/g, '\\|').substring(0, 100);
      lines.push(`| ${entry.lineNumber} | ${entry.parseError} | ${rawContent} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function saveJsonResult(result: ProcessingResult, filePath: string): void {
  const fs = require('fs');
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
}

export function saveMarkdownReport(markdown: string, filePath: string): void {
  const fs = require('fs');
  fs.writeFileSync(filePath, markdown, 'utf8');
}
