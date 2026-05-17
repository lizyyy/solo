import { EstimationResult } from './types.js';
import { formatSizeGB, formatSizeTB, formatCost } from './calculator.js';

export function generateTerminalSummary(result: EstimationResult): string {
  const lines: string[] = [];
  const { summary, topLargestTopics, invalidTopics, groupedByCostTag } = result;

  lines.push('');
  lines.push('='.repeat(70));
  lines.push('📊 日志保留估算报告');
  lines.push('='.repeat(70));
  lines.push('');

  lines.push('📈 总体概览');
  lines.push('-'.repeat(50));
  lines.push(`  日志主题总数:      ${summary.totalTopics}`);
  lines.push(`  有效主题数:        ${summary.validTopics}`);
  lines.push(`  异常主题数:        ${summary.invalidTopics}`);
  lines.push('');
  lines.push(`  日均原始大小:      ${formatSizeGB(summary.totalDailySizeGB)}`);
  lines.push(`  日均压缩后大小:    ${formatSizeGB(summary.totalCompressedDailySizeGB)}`);
  lines.push(`  压缩率:            ${((summary.totalCompressedDailySizeGB / summary.totalDailySizeGB) * 100).toFixed(1)}%`);
  lines.push('');
  lines.push(`  总保留容量:        ${formatSizeTB(summary.totalRetentionTB)}`);
  lines.push(`  估算月成本:        ${formatCost(summary.totalEstimatedCost)}`);
  lines.push('');

  lines.push('🏆 最占空间 TOP 10 主题');
  lines.push('-'.repeat(50));
  topLargestTopics.forEach((topic, index) => {
    lines.push(`  ${String(index + 1).padStart(2)}. ${topic.topic}`);
    lines.push(`      日均: ${formatSizeGB(topic.dailySizeGB).padEnd(12)} → 压缩后: ${formatSizeGB(topic.compressedDailySizeGB)}`);
    lines.push(`      保留 ${topic.retentionDays} 天 → 总容量: ${formatSizeTB(topic.totalSizeTB).padEnd(12)} 成本: ${formatCost(topic.estimatedCost)}`);
    lines.push(`      成本标签: ${topic.costTag} | 原始行号: ${topic.originalLineNumber}`);
    lines.push('');
  });

  lines.push('🏷️  按成本标签分组');
  lines.push('-'.repeat(50));
  const sortedTags = Object.entries(groupedByCostTag).sort((a, b) => b[1].totalRetentionTB - a[1].totalRetentionTB);
  sortedTags.forEach(([tag, data]) => {
    const percentage = ((data.totalRetentionTB / summary.totalRetentionTB) * 100).toFixed(1);
    lines.push(`  ${tag}: ${data.topics.length} 个主题`);
    lines.push(`      容量: ${formatSizeTB(data.totalRetentionTB).padEnd(12)} (${percentage}%) | 成本: ${formatCost(data.totalEstimatedCost)}`);
    lines.push('');
  });

  if (invalidTopics.length > 0) {
    lines.push('⚠️  异常样本详情');
    lines.push('-'.repeat(50));
    invalidTopics.forEach((invalid) => {
      lines.push(`  行 ${invalid.originalLineNumber}: ${invalid.topic || '(无主题)'}`);
      lines.push(`      错误原因: ${invalid.errorReason}`);
      lines.push(`      原始数据: 日均=${invalid.dailySizeGB}, 保留=${invalid.retentionDays}, 压缩率=${invalid.compressionRatio}, 标签=${invalid.costTag}`);
      lines.push('');
    });
  }

  lines.push('='.repeat(70));
  lines.push('');

  return lines.join('\n');
}