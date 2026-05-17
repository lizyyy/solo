import { EstimationResult } from './types.js';
import { formatSizeGB, formatSizeTB, formatCost } from './calculator.js';

export function generateMarkdownReport(result: EstimationResult): string {
  const { summary, topLargestTopics, invalidTopics, groupedByCostTag, validTopics, generatedAt, parameters } = result;

  const lines: string[] = [];

  lines.push('# 日志保留估算报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date(generatedAt).toLocaleString('zh-CN')}`);
  lines.push(`> 输入文件: ${parameters.inputFile}`);
  lines.push(`> 单位存储成本: ¥${parameters.costPerTBMonth}/TB/月`);
  lines.push('');

  lines.push('## 总体概览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 日志主题总数 | ${summary.totalTopics} |`);
  lines.push(`| 有效主题数 | ${summary.validTopics} |`);
  lines.push(`| 异常主题数 | ${summary.invalidTopics} |`);
  lines.push(`| 日均原始大小 | ${formatSizeGB(summary.totalDailySizeGB)} |`);
  lines.push(`| 日均压缩后大小 | ${formatSizeGB(summary.totalCompressedDailySizeGB)} |`);
  lines.push(`| 整体压缩率 | ${((summary.totalCompressedDailySizeGB / summary.totalDailySizeGB) * 100).toFixed(1)}% |`);
  lines.push(`| **总保留容量** | **${formatSizeTB(summary.totalRetentionTB)}** |`);
  lines.push(`| **估算月成本** | **${formatCost(summary.totalEstimatedCost)}** |`);
  lines.push('');

  lines.push('## 最占空间 TOP 10 主题');
  lines.push('');
  lines.push('| 排名 | 日志主题 | 日均原始大小 | 日均压缩后 | 保留天数 | 总容量 | 估算月成本 | 成本标签 | 原始行号 |');
  lines.push('|------|----------|--------------|------------|----------|--------|------------|----------|----------|');
  topLargestTopics.forEach((topic, index) => {
    lines.push(`| ${index + 1} | ${topic.topic} | ${formatSizeGB(topic.dailySizeGB)} | ${formatSizeGB(topic.compressedDailySizeGB)} | ${topic.retentionDays} | ${formatSizeTB(topic.totalSizeTB)} | ${formatCost(topic.estimatedCost)} | ${topic.costTag} | ${topic.originalLineNumber} |`);
  });
  lines.push('');

  lines.push('## 按成本标签分组');
  lines.push('');
  lines.push('| 成本标签 | 主题数量 | 总容量 | 容量占比 | 估算月成本 |');
  lines.push('|----------|----------|--------|----------|------------|');
  const sortedTags = Object.entries(groupedByCostTag).sort((a, b) => b[1].totalRetentionTB - a[1].totalRetentionTB);
  sortedTags.forEach(([tag, data]) => {
    const percentage = ((data.totalRetentionTB / summary.totalRetentionTB) * 100).toFixed(1);
    lines.push(`| ${tag} | ${data.topics.length} | ${formatSizeTB(data.totalRetentionTB)} | ${percentage}% | ${formatCost(data.totalEstimatedCost)} |`);
  });
  lines.push('');

  lines.push('## 所有有效主题明细');
  lines.push('');
  lines.push('| 日志主题 | 日均原始大小 | 日均压缩后 | 保留天数 | 总容量 | 估算月成本 | 成本标签 | 原始行号 |');
  lines.push('|----------|--------------|------------|----------|--------|------------|----------|----------|');
  const sortedValidTopics = [...validTopics].sort((a, b) => b.totalSizeTB - a.totalSizeTB);
  sortedValidTopics.forEach((topic) => {
    lines.push(`| ${topic.topic} | ${formatSizeGB(topic.dailySizeGB)} | ${formatSizeGB(topic.compressedDailySizeGB)} | ${topic.retentionDays} | ${formatSizeTB(topic.totalSizeTB)} | ${formatCost(topic.estimatedCost)} | ${topic.costTag} | ${topic.originalLineNumber} |`);
  });
  lines.push('');

  if (invalidTopics.length > 0) {
    lines.push('## 异常样本详情');
    lines.push('');
    lines.push('| 原始行号 | 日志主题 | 错误原因 | 原始日均大小 | 原始保留天数 | 原始压缩率 | 原始成本标签 |');
    lines.push('|----------|----------|----------|--------------|--------------|------------|--------------|');
    invalidTopics.forEach((invalid) => {
      lines.push(`| ${invalid.originalLineNumber} | ${invalid.topic || '-'} | ${invalid.errorReason} | ${invalid.dailySizeGB || '-'} | ${invalid.retentionDays || '-'} | ${invalid.compressionRatio || '-'} | ${invalid.costTag || '-'} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('*此报告由日志保留估算CLI工具自动生成*');

  return lines.join('\n');
}