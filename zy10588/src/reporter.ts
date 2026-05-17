import { AnalysisResult, FieldUsage } from './types';
import { writeFileSync } from 'fs';
import chalk from 'chalk';
import Table = require('cli-table3');

export function printTerminalSummary(result: AnalysisResult): void {
  console.log('\n' + chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue('           GraphQL 字段用量分析报告'));
  console.log(chalk.bold.blue('='.repeat(60)) + '\n');

  console.log(chalk.bold('📊 概览统计'));
  console.log(`  总查询数: ${result.totalQueries}`);
  console.log(`  成功解析: ${chalk.green(result.successfulQueries)}`);
  console.log(`  解析失败: ${chalk.red(result.failedQueries)}\n`);

  if (Object.keys(result.clientStats).length > 0) {
    console.log(chalk.bold('👥 客户端分布'));
    const clientTable = new Table({
      head: ['客户端', '查询数量'],
      colWidths: [40, 15]
    });
    for (const [client, count] of Object.entries(result.clientStats)) {
      clientTable.push([client, count.toString()]);
    }
    console.log(clientTable.toString() + '\n');
  }

  console.log(chalk.bold('🔝 字段使用排名 (Top 20)'));
  const topFields = result.fieldUsage.slice(0, 20);
  const fieldTable = new Table({
    head: ['字段路径', '使用次数'],
    colWidths: [45, 15]
  });
  for (const field of topFields) {
    fieldTable.push([field.fullPath, field.count.toString()]);
  }
  console.log(fieldTable.toString() + '\n');

  if (result.fieldUsage.length > 20) {
    console.log(chalk.gray(`  ... 还有 ${result.fieldUsage.length - 20} 个字段\n`));
  }

  if (result.errors.length > 0) {
    console.log(chalk.bold.yellow('⚠️  错误详情'));
    for (const error of result.errors) {
      const location = error.source 
        ? `${error.source}:${error.lineNumber || '?'}` 
        : '位置未知';
      console.log(`  ${chalk.yellow(location)}: ${error.message}`);
    }
    console.log('');
  }

  console.log(chalk.bold.green('✅ 分析完成!'));
  console.log(chalk.gray('  使用 --output 导出完整报告\n'));
}

export function generateJSONReport(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function generateMarkdownReport(result: AnalysisResult, schemaPath: string, queriesPath: string): string {
  const date = new Date().toISOString().split('T')[0];
  let md = `# GraphQL 字段用量分析报告\n\n`;
  md += `> 生成日期: ${date}\n`;
  md += `> Schema文件: \`${schemaPath}\`\n`;
  md += `> 查询样本: \`${queriesPath}\`\n\n`;

  md += `## 📊 概览统计\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总查询数 | ${result.totalQueries} |\n`;
  md += `| 成功解析 | ${result.successfulQueries} |\n`;
  md += `| 解析失败 | ${result.failedQueries} |\n\n`;

  if (Object.keys(result.clientStats).length > 0) {
    md += `## 👥 客户端分布\n\n`;
    md += `| 客户端 | 查询数量 |\n`;
    md += `|--------|----------|\n`;
    for (const [client, count] of Object.entries(result.clientStats).sort((a, b) => b[1] - a[1])) {
      md += `| ${client} | ${count} |\n`;
    }
    md += `\n`;
  }

  md += `## 🔝 字段使用排名\n\n`;
  md += `| 排名 | 字段路径 | 使用次数 | 客户端 |\n`;
  md += `|------|----------|----------|--------|\n`;
  result.fieldUsage.slice(0, 50).forEach((field, index) => {
    const clientList = Object.entries(field.clients)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c}(${n})`)
      .join(', ');
    md += `| ${index + 1} | \`${field.fullPath}\` | ${field.count} | ${clientList} |\n`;
  });
  md += `\n`;

  if (result.fieldUsage.length > 50) {
    md += `> 仅显示前 50 个字段，完整列表请查看 JSON 输出\n\n`;
  }

  if (result.errors.length > 0) {
    md += `## ⚠️  错误详情\n\n`;
    md += `| 位置 | 错误信息 | 原始内容 |\n`;
    md += `|------|----------|----------|\n`;
    for (const error of result.errors) {
      const location = error.source 
        ? `${error.source}:${error.lineNumber || '?'}` 
        : '位置未知';
      const rawContent = (error.rawContent || error.query || '')
        .replace(/\n/g, ' ')
        .substring(0, 100);
      md += `| ${location} | ${error.message} | \`${rawContent}\` |\n`;
    }
    md += `\n`;
  }

  md += `## 💡 操作建议\n\n`;
  md += `- **高频字段**: 请谨慎修改，确保向后兼容\n`;
  md += `- **零使用字段**: 可考虑标记为 @deprecated 或安排删除\n`;
  md += `- **错误查询**: 请修复或移除无效的查询样本\n\n`;

  return md;
}

export function exportReports(
  result: AnalysisResult,
  outputPath: string,
  format: 'json' | 'markdown' | 'both',
  schemaPath: string,
  queriesPath: string
): void {
  if (format === 'json' || format === 'both') {
    const jsonContent = generateJSONReport(result);
    writeFileSync(`${outputPath}.json`, jsonContent);
    console.log(chalk.green(`  ✓ JSON报告已导出: ${outputPath}.json`));
  }

  if (format === 'markdown' || format === 'both') {
    const mdContent = generateMarkdownReport(result, schemaPath, queriesPath);
    writeFileSync(`${outputPath}.md`, mdContent);
    console.log(chalk.green(`  ✓ Markdown报告已导出: ${outputPath}.md`));
  }
}
